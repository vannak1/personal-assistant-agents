import { StateGraph, END } from "@langgraph/langgraph";
import { personalAssistantAgent } from "./agents/personalAssistant";
import { featureRequestAgent } from "./agents/featureRequest";
import { deepResearchAgent } from "./agents/deepResearch";
import { gmeRedditSummaryAgent } from "./agents/gmeRedditSummary";
import { GraphState } from "./types";
import { createInitialState } from "./utils/helpers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Determine the next node based on the current agent in the state
 */
const router = (state: GraphState): string => {
  // If the task is completed, return to the Personal Assistant
  if (state.agentState.taskCompleted) {
    return "PersonalAssistant";
  }
  
  // Otherwise, route to the appropriate agent
  return state.agentState.currentAgent;
};

/**
 * Build and export the multi-agent graph
 */
export const buildAgentGraph = () => {
  // Create a new state graph with the initial state
  const agentGraph = new StateGraph<GraphState>({
    channels: {
      messages: {
        value: (x: GraphState) => x.messages,
        reducer: (prev, next) => [...prev, ...next.slice(prev.length)]
      },
      agentState: {
        value: (x: GraphState) => x.agentState,
        reducer: (_, next) => next
      }
    }
  });

  // Define the nodes (agents)
  agentGraph.addNode("PersonalAssistant", personalAssistantAgent);
  agentGraph.addNode("FeatureRequestAgent", featureRequestAgent);
  agentGraph.addNode("DeepResearchAgent", deepResearchAgent);
  agentGraph.addNode("GmeRedditSummaryAgent", gmeRedditSummaryAgent);

  // Set the entry point
  agentGraph.setEntryPoint("PersonalAssistant");

  // Add conditional edges
  agentGraph.addConditionalEdges(
    "PersonalAssistant",
    router,
    {
      "PersonalAssistant": END,
      "FeatureRequestAgent": "FeatureRequestAgent",
      "DeepResearchAgent": "DeepResearchAgent",
      "GmeRedditSummaryAgent": "GmeRedditSummaryAgent"
    }
  );

  // Add edges from specialized agents back to Personal Assistant
  agentGraph.addEdge("FeatureRequestAgent", "PersonalAssistant");
  agentGraph.addEdge("DeepResearchAgent", "PersonalAssistant");
  agentGraph.addEdge("GmeRedditSummaryAgent", "PersonalAssistant");

  // Compile the graph
  return agentGraph.compile();
};

/**
 * Create the main handler for the LangGraph Cloud deployment
 */
export async function handler(req: any) {
  const graph = buildAgentGraph();
  
  // Get the user input from the request
  const { messages } = req.body;
  const userMessage = messages[messages.length - 1].content;
  
  // Create an initial state and add the user message
  const initialState = createInitialState();
  initialState.messages.push({
    role: "user",
    content: userMessage
  });
  
  // Run the graph with the initial state
  const result = await graph.invoke(initialState);
  
  // Extract the assistant's response (last message)
  const assistantMessages = result.messages.filter(m => m.role === "assistant");
  const response = assistantMessages[assistantMessages.length - 1];
  
  return {
    response: response.content
  };
}

// When running locally with LangGraph dev, we need to export the graph
if (require.main === module) {
  console.log("Starting Personal Assistant Agent system...");
  const graph = buildAgentGraph();
  // LangGraph Cloud will use this export
  module.exports = { graph };
}