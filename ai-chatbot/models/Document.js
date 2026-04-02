const mongoose = require("mongoose");

const ChunkSchema = new mongoose.Schema({
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  startChar: { type: Number, default: 0 },
  endChar: { type: Number, default: 0 },
  embedding: {
    type: [Number],
    default: [],
  },
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  text: { type: String, default: "" },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: "" },
  totalChunks: { type: Number, default: 0 },
  chunks: { type: [ChunkSchema], default: [] },
  processingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  uploadedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Document", DocumentSchema);
