class ConfidenceCalculator {
  /**
   * Calculate confidence metrics for RAG response
   * @param {Object} params - Parameters {retrievedDocs, retrievalMethod, responseLogprobs}
   * @returns {Object} Confidence metrics
   */
  calculate({ retrievedDocs, retrievalMethod, responseLogprobs = null }) {
    if (!retrievedDocs || retrievedDocs.length === 0) {
      return {
        overallConfidence: 0,
        retrievalConfidence: 0,
        responseConfidence: null,
        retrievalMethod: retrievalMethod || 'none'
      };
    }

    const retrievalConfidence = this.calculateRetrievalConfidence(retrievedDocs);

    const responseConfidence = responseLogprobs
      ? this.calculateResponseConfidence(responseLogprobs)
      : null;

    const overallConfidence = responseConfidence !== null
      ? (retrievalConfidence * 0.6 + responseConfidence * 0.4)
      : retrievalConfidence;

    return {
      overallConfidence: Math.min(Math.max(overallConfidence, 0), 1),
      retrievalConfidence: Math.min(Math.max(retrievalConfidence, 0), 1),
      responseConfidence,
      retrievalMethod: retrievalMethod || 'unknown'
    };
  }

  calculateRetrievalConfidence(docs) {
    if (docs.length === 0) return 0;

    const scores = docs.map(d => d.relevanceScore || d.score || 0);

    const topScore = scores[0] || 0;

    const gap = docs.length > 1
      ? (scores[0] - scores[1])
      : 0;

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const confidence = (
      topScore * 0.5 +
      gap * 0.3 +
      avgScore * 0.2
    );

    return confidence;
  }

  calculateResponseConfidence(logprobs) {
    if (!logprobs || logprobs.length === 0) return null;

    const avgLogprob = logprobs.reduce((sum, lp) => sum + lp.logprob, 0) / logprobs.length;
    const confidence = Math.exp(avgLogprob);

    return confidence;
  }
}

module.exports = new ConfidenceCalculator();
