const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const ragPanel = document.getElementById("rag-panel");
const evidenceList = document.getElementById("evidence-list");
const confidenceBadge = document.getElementById("confidence-badge");

// If not on the chat page, stop here
if (!inputField || !sendBtn || !messagesContainer) {
  throw new Error("Chat elements not found — not on chat page.");
}

function getParticipantID() {
  const storageKey = "participantID";
  let participantID = localStorage.getItem(storageKey);

  if (!participantID) {
    participantID =
      window.crypto?.randomUUID?.() ||
      `participant-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem(storageKey, participantID);
  }

  return participantID;
}

const participantID = getParticipantID();

function appendMessage(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");

  if (sender === "user") {
    messageDiv.innerHTML = `
      <div class="message-bubble">${text}</div>
      <div class="message-avatar">You</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-bubble">${text}</div>
    `;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayEvidence(retrievedEvidence, confidenceMetrics) {
  if (!ragPanel || !evidenceList || !confidenceBadge) return;

  if (!retrievedEvidence || retrievedEvidence.length === 0) {
    ragPanel.classList.add("hidden");
    return;
  }

  // Show confidence badge
  if (confidenceMetrics) {
    const pct = Math.round((confidenceMetrics.overallConfidence || 0) * 100);
    confidenceBadge.textContent = `Confidence: ${pct}%`;
    confidenceBadge.className = "confidence-badge " + (
      pct >= 70 ? "confidence-high" :
      pct >= 40 ? "confidence-mid" :
      "confidence-low"
    );
  } else {
    confidenceBadge.textContent = "";
  }

  // Populate evidence chunks
  evidenceList.innerHTML = "";
  retrievedEvidence.forEach((item, i) => {
    const score = (item.relevanceScore || 0).toFixed(4);
    const li = document.createElement("li");
    li.className = "evidence-item";
    li.innerHTML = `
      <div class="evidence-meta">
        <span class="evidence-source">${item.documentName || "Unknown"}</span>
        <span class="evidence-score">Score: ${score}</span>
      </div>
      <div class="evidence-text">${item.chunkText.slice(0, 200)}${item.chunkText.length > 200 ? "…" : ""}</div>
    `;
    evidenceList.appendChild(li);
  });

  ragPanel.classList.remove("hidden");
}

async function logEvent(eventType, details = {}) {
  try {
    await fetch("/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantID,
        eventType,
        elementName: details.elementName,
      }),
    });
  } catch (error) {
    console.error("Error logging event:", error);
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantID }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const history = Array.isArray(data.history) ? data.history : [];

    if (history.length === 0) {
      return;
    }

    messagesContainer.innerHTML = "";

    history.forEach((interaction) => {
      appendMessage(interaction.userInput, "user");
      appendMessage(interaction.botResponse, "bot");
    });
  } catch (error) {
    console.error("Error loading history:", error);
  }
}

async function sendMessage() {
  const userText = inputField.value.trim();

  if (userText === "") {
    alert("Please enter a message before sending.");
    return;
  }

  appendMessage(userText, "user");
  inputField.value = "";

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantID,
        message: userText,
        retrievalMethod: retrievalDropdown.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send chat message.");
    }

    appendMessage(data.reply, "bot");
    displayEvidence(data.retrievedEvidence, data.confidenceMetrics);

    await logEvent("send_message", {
      elementName: "send-btn",
    });
  } catch (error) {
    console.error("Error communicating with server:", error);
    appendMessage("Sorry, something went wrong while contacting the server.", "bot");
  }
}

sendBtn.addEventListener("click", () => {
  sendMessage();
});

inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

inputField.addEventListener("focus", () => {
  logEvent("input_focus", { elementName: "user-input" });
});

sendBtn.addEventListener("mouseenter", () => {
  logEvent("hover", { elementName: "send-btn" });
});

retrievalDropdown.addEventListener("change", () => {
  const selectedMethod = retrievalDropdown.value;

  appendMessage(`Retrieval method changed to: ${selectedMethod}`, "bot");
  logEvent("retrieval_change", {
    elementName: "retrieval-method",
  });
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  const fileText = document.querySelector(".file-text");
  if (fileText) {
    fileText.textContent = file ? file.name : "Choose a file\u2026";
  }
});

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    alert("Choose a file first.");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading…";

  const formData = new FormData();
  formData.append("document", file);

  try {
    const response = await fetch("/upload-document", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Upload failed.");
      return;
    }

    fileInput.value = "";
    const fileText = document.querySelector(".file-text");
    if (fileText) fileText.textContent = "Choose a file\u2026";

    await loadDocuments();
    logEvent("upload_click", { elementName: "upload-btn" });
  } catch (error) {
    console.error("Error uploading document:", error);
    alert("Upload failed. Check the console for details.");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload";
  }
});

async function loadDocuments() {
  const response = await fetch("/documents");
  const docs = await response.json();

  const documentsList = document.getElementById("uploaded-docs");
  documentsList.innerHTML = "";

  if (docs.length === 0) {
    documentsList.innerHTML = '<li class="doc-placeholder">No documents uploaded yet.</li>';
    return;
  }

  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.textContent = `${doc.filename} — ${doc.processingStatus}`;
    documentsList.appendChild(li);
  });
}

loadHistory();
loadDocuments();
