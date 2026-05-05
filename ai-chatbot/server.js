const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const mongoose = require("mongoose");
const OpenAI = require("openai");
const Interaction = require("./models/Interaction");
const EventLog = require("./models/EventLog");
const Document = require("./models/Document");
const multer = require("multer");
const fs = require("fs").promises;
const documentProcessor = require("./services/documentProcessor");
const embeddingService = require("./services/embeddingService");
const retrievalService = require("./services/retrievalService");
const confidenceCalculator = require("./services/confidenceCalculator");

const upload = multer({ dest: "uploads/" });

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const mongoUri = process.env.MONGODB_URI;
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const openai = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;

let mongoReady = false;

async function connectToMongoDB() {
  if (!mongoUri) {
    console.warn("MONGODB_URI is not set. MongoDB logging is disabled.");
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    mongoReady = true;
    console.log("Connected to MongoDB.");
    await retrievalService.initialize();
    console.log("Retrieval service initialized.");
  } catch (error) {
    mongoReady = false;
    console.error("Failed to connect to MongoDB:", error.message);
  }
}

function requireParticipantID(participantID, res) {
  if (!participantID || typeof participantID !== "string" || !participantID.trim()) {
    res.status(400).json({ error: "participantID is required." });
    return false;
  }

  return true;
}

function ensureMongoConnection(res) {
  if (!mongoReady) {
    res.status(503).json({ error: "MongoDB is not connected. Check MONGODB_URI." });
    return false;
  }

  return true;
}

function buildRagPrompt(userMessage, retrievedChunks) {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return userMessage;
  }

  const contextBlocks = retrievedChunks
    .map((chunk, i) => {
      const source = chunk.documentName || "Unknown";
      const score = (chunk.relevanceScore || chunk.score || 0).toFixed(4);
      return `[Source ${i + 1}: ${source} | Score: ${score}]\n${chunk.chunkText}`;
    })
    .join("\n\n");

  return `Use the following retrieved context to answer the user's question. If the context is not relevant, answer from your general knowledge.\n\nContext:\n${contextBlocks}\n\nUser question: ${userMessage}`;
}

const USF_CONTEXT = `You are assisting students at the University of San Francisco (USF), located in San Francisco, California. USF always refers to the University of San Francisco — never the University of South Florida or any other institution. Do not fabricate specific building names, program names, dollar amounts, or other details you are not certain about. If you lack specific USF information, say so honestly and speak in general terms instead.`;

const SYSTEM_PROMPTS = {
  1: `${USF_CONTEXT} Answer clearly and concisely based on the provided context when available.`,
  2: `${USF_CONTEXT} Format every response to maximize clarity and decision-making readability:
- Begin EVERY response with exactly one sentence on its own line starting with "**Chat:**" — a plain-language summary of your answer. This line is displayed in the chat panel and must stand alone.
- When comparing multiple options, ALWAYS render the comparison as a proper markdown table with | pipe | syntax.
- Use ## for section headers and **bold** for key terms, numbers, and important facts.
- Group information into clearly labeled sections with headers.
- End EVERY response with a section titled "**Next Steps:**" that lists exactly 2-3 numbered action statements (not questions) the user can click to continue, e.g. "Show me the cheapest option", "Help me make a final decision", "Compare commute times for each option".
Answer clearly and concisely based on the provided context when available.`,
};

async function generateReply(message, retrievalMethod, retrievedChunks, conversationHistory, systemID) {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const userContent = buildRagPrompt(message, retrievedChunks);
  const systemPrompt = SYSTEM_PROMPTS[parseInt(systemID)] || SYSTEM_PROMPTS[1];

  const historyMessages = (conversationHistory || []).map((turn) => ({
    role: turn.role,
    content: [
      {
        type: turn.role === "user" ? "input_text" : "output_text",
        text: turn.content,
      },
    ],
  }));

  const response = await openai.responses.create({
    model: openAiModel,
    instructions: systemPrompt,
    input: [
      ...historyMessages,
      {
        role: "user",
        content: [{ type: "input_text", text: userContent }],
      },
    ],
  });

  return response.output_text && response.output_text.trim()
    ? response.output_text.trim()
    : "I could not generate a response.";
}

app.use(express.json());
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.post("/chat", async (req, res) => {
  const { participantID, message, retrievalMethod, conversationHistory, systemID } = req.body;

  if (!requireParticipantID(participantID, res)) {
    return;
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  if (!ensureMongoConnection(res)) {
    return;
  }

  try {
    const parsedSystemID = parseInt(systemID) || 1;
    const method = retrievalMethod || "semantic";

    const retrievedChunks = await retrievalService.retrieve(message.trim(), {
      method,
      topK: 3,
      minScore: method === "tfidf" ? 0 : 0.3,
    });

    const confidenceMetrics = confidenceCalculator.calculate({
      retrievedDocs: retrievedChunks,
      retrievalMethod: method,
    });

    const reply = await generateReply(message.trim(), method, retrievedChunks, conversationHistory, parsedSystemID);

    const interaction = await Interaction.create({
      participantID: participantID.trim(),
      userInput: message.trim(),
      botResponse: reply,
      retrievalMethod: method,
      retrievedEvidence: retrievedChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        relevanceScore: chunk.relevanceScore || chunk.score || 0,
      })),
      confidenceMetrics,
    });

    res.json({
      reply,
      interactionID: interaction._id,
      retrievedEvidence: retrievedChunks.map((chunk) => ({
        documentName: chunk.documentName,
        chunkText: chunk.chunkText,
        relevanceScore: chunk.relevanceScore || chunk.score || 0,
      })),
      confidenceMetrics,
    });
  } catch (error) {
    console.error("Error in /chat:", error.message);
    res.status(500).json({ error: "Unable to process chat request." });
  }
});

app.post("/log-event", async (req, res) => {
  const { participantID, eventType, elementName } = req.body;

  if (!requireParticipantID(participantID, res)) {
    return;
  }

  if (!eventType || typeof eventType !== "string" || !eventType.trim()) {
    return res.status(400).json({ error: "eventType is required." });
  }

  if (!ensureMongoConnection(res)) {
    return;
  }

  try {
    const normalizedElementName =
      typeof elementName === "string" && elementName.trim() ? elementName.trim() : null;

    if (!normalizedElementName) {
      return res.status(400).json({ error: "elementName is required." });
    }

    const eventLog = await EventLog.create({
      participantID: participantID.trim(),
      eventType: eventType.trim(),
      elementName: normalizedElementName,
    });

    res.status(201).json({
      success: true,
      eventID: eventLog._id,
    });
  } catch (error) {
    console.error("Error in /log-event:", error.message);
    res.status(500).json({ error: "Unable to log event." });
  }
});

app.post("/history", async (req, res) => {
  const { participantID } = req.body;

  if (!requireParticipantID(participantID, res)) {
    return;
  }

  if (!ensureMongoConnection(res)) {
    return;
  }

  try {
    const history = (
      await Interaction.find({ participantID: participantID.trim() })
        .sort({ timestamp: -1 })
        .limit(5)
        .lean()
    ).reverse();

    res.json({ history });
  } catch (error) {
    console.error("Error in /history:", error.message);
    res.status(500).json({ error: "Unable to load chat history." });
  }
});

app.post("/upload-document", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  if (!ensureMongoConnection(res)) {
    return;
  }

  let documentRecord = null;

  try {
    documentRecord = await Document.create({
      filename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      processingStatus: "processing",
    });

    const processed = await documentProcessor.processDocument(req.file);
    const chunksWithEmbeddings = await embeddingService.generateEmbeddings(processed.chunks);

    documentRecord.text = processed.fullText;
    documentRecord.fileSize = processed.fileSize;
    documentRecord.totalChunks = processed.totalChunks;
    documentRecord.chunks = chunksWithEmbeddings.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      startChar: chunk.startChar,
      endChar: chunk.endChar,
      embedding: chunk.embedding || [],
    }));
    documentRecord.processingStatus = "completed";
    documentRecord.processedAt = new Date();
    await documentRecord.save();

    await retrievalService.rebuildIndex();

    res.status(201).json({
      status: "success",
      document: {
        id: documentRecord._id,
        filename: documentRecord.filename,
        processingStatus: documentRecord.processingStatus,
        processedAt: documentRecord.processedAt,
      },
      chunkCount: documentRecord.chunks.length,
    });
  } catch (error) {
    if (documentRecord) {
      documentRecord.processingStatus = "failed";
      await documentRecord.save().catch(() => {});
    }

    console.error("Error uploading document:", error.message);
    res.status(500).json({ error: "Failed to process document" });
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

app.get("/documents", async (req, res) => {
  if (!ensureMongoConnection(res)) {
    return;
  }

  try {
    const docs = await Document.find(
      {},
      {
        _id: 1,
        filename: 1,
        processingStatus: 1,
        processedAt: 1,
      }
    ).sort({ uploadedAt: -1 });

    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error.message);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

connectToMongoDB().finally(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});


app.post('/redirect-to-survey', (req, res) => {
  const { participantID } = req.body;

  const qualtricsBaseUrl = 'https://usfca.qualtrics.com/jfe/form/SV_0x3jawuLQJoRk2i';

  const surveyUrl = `${qualtricsBaseUrl}?participantID=${encodeURIComponent(participantID)}`;

  res.send(surveyUrl);
});

app.post('/redirect-to-pre-task-survey-1', (req, res) => {
  const { participantID } = req.body;
  const baseUrl = 'https://usfca.qualtrics.com/jfe/form/SV_0x3jawuLQJoRk2i';
  res.send(`${baseUrl}?participantID=${encodeURIComponent(participantID)}`);
});

app.post('/redirect-to-pre-task-survey-2', (req, res) => {
  const { participantID } = req.body;
  const baseUrl = 'https://usfca.qualtrics.com/jfe/form/SV_bmEudIfiWr5bk0K';
  res.send(`${baseUrl}?participantID=${encodeURIComponent(participantID)}`);
});

app.post('/redirect-to-post-task-survey', (req, res) => {
  const { participantID } = req.body;
  // TODO: Replace with post-task survey URL
  const baseUrl = 'https://usfca.qualtrics.com/jfe/form/PLACEHOLDER';
  res.send(`${baseUrl}?participantID=${encodeURIComponent(participantID)}`);
});
