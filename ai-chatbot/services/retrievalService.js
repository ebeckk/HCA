const natural = require('natural');
const TfIdf = natural.TfIdf;
const Document = require('../models/Document');
const { cosineSimilarity } = require('../utils/vectorUtils');
const embeddingService = require('./embeddingService');

class TFIDFRetriever {
  constructor() {
    this.tfidf = null;
    this.chunkMap = [];
    this.isIndexed = false;
  }

  async buildIndex() {
    try {
      console.log('Building TF-IDF index...');

      const documents = await Document.find({ processingStatus: 'completed' });

      if (documents.length === 0) {
        console.log('No documents found to index');
        this.isIndexed = false;
        return;
      }

      this.tfidf = new TfIdf();
      this.chunkMap = [];

      documents.forEach(doc => {
        if (doc.chunks && doc.chunks.length > 0) {
          doc.chunks.forEach(chunk => {
            this.tfidf.addDocument(chunk.text);
            this.chunkMap.push({
              documentId: doc._id,
              documentName: doc.filename,
              chunkIndex: chunk.chunkIndex,
              chunkText: chunk.text
            });
          });
        }
      });

      this.isIndexed = true;
      console.log(`TF-IDF index built with ${this.chunkMap.length} chunks from ${documents.length} documents`);
    } catch (error) {
      console.error('Error building TF-IDF index:', error);
      this.isIndexed = false;
      throw error;
    }
  }

  retrieve(query, topK = 3, minScore = 0) {
    if (!this.isIndexed || !this.tfidf) {
      console.warn('TF-IDF index not built. Returning empty results.');
      return [];
    }

    const scores = [];

    this.tfidf.tfidfs(query, (i, measure) => {
      if (measure >= minScore) {
        scores.push({ index: i, score: measure });
      }
    });

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map(item => ({
      ...this.chunkMap[item.index],
      score: item.score,
      relevanceScore: item.score
    }));
  }
}

class SemanticRetriever {
  async retrieve(query, topK = 3, minScore = 0.3) {
    try {
      console.log('Generating query embedding...');
      const queryEmbedding = await embeddingService.generateQueryEmbedding(query);

      const documents = await Document.find({
        processingStatus: 'completed',
        'chunks.embedding': { $exists: true, $ne: [] }
      });

      if (documents.length === 0) {
        console.log('No documents with embeddings found');
        return [];
      }

      const similarities = [];

      documents.forEach(doc => {
        if (doc.chunks && doc.chunks.length > 0) {
          doc.chunks.forEach(chunk => {
            if (chunk.embedding && chunk.embedding.length > 0) {
              const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);

              if (similarity >= minScore) {
                similarities.push({
                  documentId: doc._id,
                  documentName: doc.filename,
                  chunkIndex: chunk.chunkIndex,
                  chunkText: chunk.text,
                  score: similarity,
                  relevanceScore: similarity
                });
              }
            }
          });
        }
      });

      similarities.sort((a, b) => b.score - a.score);

      console.log(`Found ${similarities.length} chunks above threshold, returning top ${topK}`);
      return similarities.slice(0, topK);
    } catch (error) {
      console.error('Error in semantic retrieval:', error);
      throw error;
    }
  }
}

class RetrievalService {
  constructor() {
    this.tfidfRetriever = new TFIDFRetriever();
    this.semanticRetriever = new SemanticRetriever();
  }

  async initialize() {
    await this.tfidfRetriever.buildIndex();
  }

  async rebuildIndex() {
    await this.tfidfRetriever.buildIndex();
  }

  async retrieve(query, options = {}) {
    const {
      method = 'semantic',
      topK = 3,
      minScore = 0.3
    } = options;

    try {
      if (method === 'tfidf') {
        return this.tfidfRetriever.retrieve(query, topK, minScore);
      } else if (method === 'semantic') {
        return await this.semanticRetriever.retrieve(query, topK, minScore);
      } else {
        throw new Error(`Unknown retrieval method: ${method}`);
      }
    } catch (error) {
      console.error(`Error in ${method} retrieval:`, error);
      return [];
    }
  }
}

module.exports = new RetrievalService();
