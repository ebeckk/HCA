const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

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

uploadBtn.addEventListener("click", () => {
  if (fileInput.files.length > 0) {
    const selectedFile = fileInput.files[0].name;
    console.log(`Selected file: ${selectedFile}`);
    logEvent("upload_click", {
      elementName: "upload-btn",
    });
  } else {
    console.log("No file selected.");
    logEvent("upload_click", {
      elementName: "upload-btn",
    });
  }
});

loadHistory();
