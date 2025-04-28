import axios from 'axios';

// Mock knowledge base for demonstration purposes
// In a real implementation, this would be replaced with actual retrieval systems
const knowledgeBase = new Map<string, string[]>([
  ['blockchain', [
    'Blockchain is a distributed ledger technology that enables secure transactions without a central authority.',
    'The first blockchain was created as the underlying technology for Bitcoin by Satoshi Nakamoto in 2008.',
    'Smart contracts are self-executing contracts with the terms directly written into code on blockchain platforms like Ethereum.'
  ]],
  ['machine learning', [
    'Machine learning is a subset of artificial intelligence that focuses on developing systems that learn from data.',
    'Supervised learning involves training models on labeled data, while unsupervised learning works with unlabeled data.',
    'Deep learning uses neural networks with many layers to process complex patterns in large amounts of data.'
  ]],
  ['climate change', [
    'Climate change refers to long-term shifts in temperatures and weather patterns, primarily caused by human activities.',
    'The burning of fossil fuels is a major contributor to greenhouse gas emissions.',
    'Effects include rising sea levels, increased frequency of extreme weather events, and disruption of ecosystems.'
  ]]
]);

/**
 * Performs research on a given question by accessing various knowledge sources
 * @param question The research question
 * @returns Array of relevant information from different sources
 */
export const performResearch = async (question: string): Promise<string[]> => {
  const results: string[] = [];
  
  try {
    // Step 1: Search our internal knowledge base (mock)
    const keywords = extractKeywords(question);
    for (const keyword of keywords) {
      const knowledgeEntries = knowledgeBase.get(keyword.toLowerCase());
      if (knowledgeEntries) {
        results.push(...knowledgeEntries.map(entry => `[Internal Knowledge Base] ${entry}`));
      }
    }
    
    // Step 2: In a real implementation, we would add external API calls here
    // This is a placeholder for demonstration purposes
    if (keywords.length > 0 && results.length === 0) {
      // Mock an external API call result
      results.push(
        `[External API] Based on recent research, the topic of ${keywords[0]} has seen significant developments in the past year.`,
        `[External API] Experts in ${keywords[0]} suggest that continued research is necessary to fully understand its implications.`
      );
    }
    
    // Step 3: If no results found, provide a generic response
    if (results.length === 0) {
      results.push(
        "[Research] The research question appears to be outside our current knowledge domain.",
        "[Research] Consider refining the question or exploring more specific aspects of the topic."
      );
    }
    
    return results;
  } catch (error) {
    console.error("Error in research tools:", error);
    return [
      "[Research Error] An error occurred while performing research.",
      "[Research Error] Please try again with a more specific question."
    ];
  }
};

/**
 * Simple keyword extraction from a question
 * In a real implementation, this would use NLP techniques
 */
const extractKeywords = (question: string): string[] => {
  // Convert to lowercase and remove punctuation
  const cleaned = question.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Split into words
  const words = cleaned.split(/\s+/);
  
  // Remove common stop words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'in', 'on', 'at', 'of', 'to', 'for', 'with', 'is', 'are', 'what', 'why', 'how', 'when', 'where', 'who']);
  const filteredWords = words.filter(word => !stopWords.has(word) && word.length > 2);
  
  // Check for important phrases
  const importantPhrases = ['machine learning', 'artificial intelligence', 'blockchain', 'climate change', 'quantum computing'];
  
  for (const phrase of importantPhrases) {
    if (cleaned.includes(phrase)) {
      return [phrase];
    }
  }
  
  // Return most frequent non-stop words (simple approach)
  const wordFrequency: Record<string, number> = {};
  for (const word of filteredWords) {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  }
  
  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);