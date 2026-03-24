const mongoose = require("mongoose");

const interactionSchema = new mongoose.Schema({
  participantID: { type: String, required: true, index: true, trim: true },
  userInput: { type: String, required: true, trim: true },
  botResponse: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Interaction", interactionSchema);
