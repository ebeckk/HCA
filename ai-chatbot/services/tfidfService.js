const Document = require("../models/Document");

class TfIdfService {
  constructor() {
    this.index = [];
    this.documentFrequency = new Map();
    this.totalChunks = 0;
  }

  tokenize(text) {
    if (!text || typeof text !== "string") {
      return [];
    }

    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
  }

  async rebuildIndex() {
    const documents = await Document.find(
      { processingStatus: "completed" },
      { filename: 1, chunks: 1 }
    ).lean();

    const chunkEntries = [];
    const documentFrequency = new Map();

    documents.forEach((document) => {
      (document.chunks || []).forEach((chunk) => {
        const tokens = this.tokenize(chunk.text);
        const termFrequency = new Map();

        tokens.forEach((token) => {
          termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
        });

        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach((token) => {
          documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
        });

        chunkEntries.push({
          documentId: document._id.toString(),
          filename: document.filename,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          termFrequency,
        });
      });
    });

    this.index = chunkEntries;
    this.documentFrequency = documentFrequency;
    this.totalChunks = chunkEntries.length;

    return {
      totalDocuments: documents.length,
      totalChunks: this.totalChunks,
    };
  }
}

module.exports = new TfIdfService();
