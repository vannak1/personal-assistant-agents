import { ChatOpenAI } from "@langchain/openai";
import { GraphState, Message, AgentResponse } from "../types";

// Initialize the language model
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.2,
});

/**
 * Analyzes user input and determines which specialized agent should handle the request
 * @param state Current graph state
 * @returns Updated state with routing decision
 */
export const personalAssistantAgent = async (state: GraphState): Promise<AgentResponse> => {
  // Extract the latest user message
  const latestMessage = state.messages.filter(m => m.role === "user").slice(-1)[0];
  
  if (!latestMessage) {
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "Hello! I'm your personal assistant. How can I help you today?",
          agentName: "PersonalAssistant"
        }
      ],
      agentState: { 
        ...state.agentState,
        currentAgent: "PersonalAssistant",
        taskCompleted: false
      }
    };
  }

  try {
    // Determine which agent should handle this request
    const response = await llm.invoke([
      {
        role: "system",
        content: `You are a router agent that analyzes user requests and directs them to the appropriate specialized agent.
          - If the user is reporting a problem, suggesting a feature, or describing a pain point, route to "FeatureRequestAgent"
          - If the user is asking a complex research question that requires deep analysis, route to "DeepResearchAgent"
          - If the user is asking about GameStop (GME) Reddit activity or stock sentiment, route to "GmeRedditSummaryAgent"
          - For general questions or if no specialized agent is appropriate, respond as "PersonalAssistant"
          
          Respond with only the agent name.`
      },
      { role: "user", content: latestMessage.content }
    ]);

    // Extract agent name from response
    const agentName = response.content.trim();
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: getRoutingMessage(agentName, latestMessage.content),
          agentName: "PersonalAssistant"
        }
      ],
      agentState: {
        ...state.agentState,
        currentAgent: agentName,
        taskCompleted: false
      }
    };
  } catch (error) {
    console.error("Error in personal assistant agent:", error);
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "I encountered an issue while processing your request. Please try again.",
          agentName: "PersonalAssistant"
        }
      ],
      agentState: { 
        ...state.agentState,
        currentAgent: "PersonalAssistant",
        taskCompleted: false
      }
    };
  }
};

/**
 * Generates appropriate routing messages based on the selected agent
 */
const getRoutingMessage = (agentName: string, userMessage: string): string => {
  switch (agentName) {
    case "FeatureRequestAgent":
      return "I understand you have a feature idea or suggestion. Let me help document that for you.";
    case "DeepResearchAgent":
      return "That's an interesting question that requires some research. Let me dig into that for you.";
    case "GmeRedditSummaryAgent":
      return "I'll gather the latest information about GME from Reddit for you.";
    default:
      return "How can I assist you today?";
  }
};