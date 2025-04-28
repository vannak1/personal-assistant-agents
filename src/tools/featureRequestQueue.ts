import { FeatureRequest } from '../types';

// In-memory feature request queue
// In a production environment, this would be replaced with a persistent storage solution
let featureRequests: FeatureRequest[] = [];

/**
 * Adds a feature request to the queue
 * @param request The feature request to add
 * @returns The added feature request
 */
export const addFeatureRequest = async (request: FeatureRequest): Promise<FeatureRequest> => {
  featureRequests.push(request);
  console.log(`Added feature request: ${request.title}`);
  
  // In a real implementation, you might:
  // - Send to a database
  // - Push to a message queue
  // - Call an external API
  
  return request;
};

/**
 * Retrieves all feature requests
 * @returns Array of all feature requests
 */
export const getAllFeatureRequests = async (): Promise<FeatureRequest[]> => {
  return [...featureRequests];
};

/**
 * Retrieves the most recent feature requests
 * @param count Number of requests to retrieve
 * @returns Array of recent feature requests
 */
export const getRecentFeatureRequests = async (count: number = 5): Promise<FeatureRequest[]> => {
  return [...featureRequests]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, count);
};

/**
 * Clears all feature requests (for testing purposes)
 */
export const clearFeatureRequests = async (): Promise<void> => {
  featureRequests = [];
  console.log('Cleared feature request queue');
};