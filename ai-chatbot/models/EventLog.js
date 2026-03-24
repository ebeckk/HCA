const mongoose = require("mongoose");

const eventLogSchema = new mongoose.Schema({
  participantID: { type: String, required: true, index: true, trim: true },
  eventType: { type: String, required: true, trim: true },
  elementName: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("EventLog", eventLogSchema);
