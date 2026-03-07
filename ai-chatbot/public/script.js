const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");

function sendMessage() {
  const userText = inputField.value.trim();

  if (userText === "") {
    alert("Please enter a message before sending.");
    return;
  }

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", "user-message");
  messageDiv.innerHTML = `
    <div class="message-bubble">${userText}</div>
    <div class="message-avatar">You</div>
  `;
  messagesContainer.appendChild(messageDiv);

  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  inputField.value = "";

  const retrievalMethod = document.getElementById("retrieval-method").value;

  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText, retrievalMethod: retrievalMethod }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Server response:", data);
      const botDiv = document.createElement("div");
      botDiv.classList.add("message", "bot-message");
      botDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-bubble">Bot: "${data.reply}"</div>
      `;
      messagesContainer.appendChild(botDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    })
    .catch((error) => {
      console.error("Error communicating with server:", error);
    });
}

sendBtn.addEventListener("click", sendMessage);

inputField.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

const retrievalDropdown = document.getElementById("retrieval-method");
retrievalDropdown.addEventListener("change", function () {
  const selectedMethod = retrievalDropdown.value;
  console.log(`Retrieval method: ${selectedMethod}`);

  const systemMessage = document.createElement("div");
  systemMessage.classList.add("message", "bot-message");
  systemMessage.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-bubble">Retrieval method changed to: ${selectedMethod}</div>
  `;
  messagesContainer.appendChild(systemMessage);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
uploadBtn.addEventListener("click", function () {
  if (fileInput.files.length > 0) {
    const selectedFile = fileInput.files[0].name;
    console.log(`Selected file: ${selectedFile}`);
  } else {
    console.log("No file selected.");
  }
});
