const OpenAI = require("openai");

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const openAiApiKey = process.env.OPENAI_API_KEY;

const openai = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;

class EmbeddingService {
  async generateEmbedding(text) {
    if (!openai) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const normalizedText = typeof text === "string" ? text.trim() : "";
    if (!normalizedText) {
      return [];
    }

    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: normalizedText,
    });

    return response.data?.[0]?.embedding || [];
  }

  async generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (!openai) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const normalizedTexts = texts.map((text) => (
      typeof text === "string" ? text.trim() : ""
    ));

    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: normalizedTexts,
    });

    return response.data.map((item) => item.embedding || []);
  }
}

module.exports = new EmbeddingService();
