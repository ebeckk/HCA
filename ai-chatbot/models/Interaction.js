const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  documentName: { type: String },
  chunkIndex: { type: Number },
  chunkText: { type: String },
  relevanceScore: { type: Number },
}, { _id: false });

const confidenceSchema = new mongoose.Schema({
  overallConfidence: { type: Number },
  retrievalConfidence: { type: Number },
  responseConfidence: { type: Number, default: null },
  retrievalMethod: { type: String },
}, { _id: false });

const interactionSchema = new mongoose.Schema({
  participantID: { type: String, required: true, index: true, trim: true },
  userInput: { type: String, required: true, trim: true },
  botResponse: { type: String, required: true, trim: true },
  retrievalMethod: { type: String, default: null },
  retrievedEvidence: { type: [evidenceSchema], default: [] },
  confidenceMetrics: { type: confidenceSchema, default: null },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Interaction", interactionSchema);
