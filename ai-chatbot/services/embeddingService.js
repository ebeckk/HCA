const { OpenAI } = require('openai');

class EmbeddingService {
  constructor() {
    this._openai = null;
    this.model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.batchSize = 100;
  }

  get openai() {
    if (!this._openai) {
      this._openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._openai;
  }

  /**
   * Generate embeddings for text chunks
   * @param {Array} chunks - Array of chunk objects with text
   * @returns {Array} Chunks with embeddings added
   */
  async generateEmbeddings(chunks) {
    try {
      if (!chunks || chunks.length === 0) {
        return [];
      }

      const chunksWithEmbeddings = [];

      for (let i = 0; i < chunks.length; i += this.batchSize) {
        const batch = chunks.slice(i, i + this.batchSize);
        const texts = batch.map(chunk => chunk.text);

        console.log(`Generating embeddings for batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunks.length / this.batchSize)}`);

        const response = await this.openai.embeddings.create({
          model: this.model,
          input: texts
        });

        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: response.data[index].embedding
          });
        });

        if (i + this.batchSize < chunks.length) {
          await this.sleep(100);
        }
      }

      return chunksWithEmbeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generate a single embedding for a query
   * @param {string} text - Query text
   * @returns {Array} Embedding vector
   */
  async generateQueryEmbedding(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text for embedding generation');
      }

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating query embedding:', error);
      throw new Error(`Failed to generate query embedding: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EmbeddingService();
