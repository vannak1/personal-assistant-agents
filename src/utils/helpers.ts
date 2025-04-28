import { GraphState, Message } from '../types';

/**
 * Creates an initial state for the graph
 * @returns New graph state with empty messages and default agent state
 */
export const createInitialState = (): GraphState => {
  return {
    messages: [
      {
        role: "system",
        content: "You are a helpful personal assistant that can handle various tasks through specialized agents."
      }
    ],
    agentState: {
      currentAgent: "PersonalAssistant",
      taskCompleted: false,
      featureRequests: []
    }
  };
};

/**
 * Formats a user message for processing
 * @param content User message content
 * @returns Formatted message object
 */
export const formatUserMessage = (content: string): Message => {
  return {
    role: "user",
    content
  };
};

/**
 * Extracts all messages for a given agent from the conversation history
 * @param state Current graph state
 * @param agentName Name of the agent to filter messages for
 * @returns Array of messages for the specified agent
 */
export const getAgentMessages = (state: GraphState, agentName: string): Message[] => {
  return state.messages.filter(message => 
    message.role === "assistant" && message.agentName === agentName
  );
};

/**
 * Get the last N messages from the conversation
 * @param state Current graph state 
 * @param count Number of messages to retrieve
 * @returns Array of the most recent messages
 */
export const getRecentMessages = (state: GraphState, count: number = 5): Message[] => {
  return state.messages.slice(-count);
};

/**
 * Combines context from multiple sources into a single prompt
 * @param basePrompt Base system prompt
 * @param contextSources Additional context strings to include
 * @returns Combined prompt with all context
 */
export const combinePromptContext = (basePrompt: string, ...contextSources: string[]): string => {
  return [basePrompt, ...contextSources].join('\n\n');
};

/**
 * Extracts parameters from a user message using a simple pattern matching approach
 * @param message User message to analyze
 * @param paramPatterns Map of parameter names to regex patterns
 * @returns Object with extracted parameters
 */
export const extractParamsFromMessage = (
  message: string, 
  paramPatterns: Record<string, RegExp>
): Record<string, string | null> => {
  const params: Record<string, string | null> = {};
  
  for (const [paramName, pattern] of Object.entries(paramPatterns)) {
    const match = message.match(pattern);
    params[paramName] = match ? match[1] : null;
  }
  
  return params;
};