import { ChatOpenAI } from "@langchain/openai";
import { GraphState, FeatureRequest, AgentResponse } from "../types";
import { addFeatureRequest } from "../tools/featureRequestQueue";

// Initialize the language model
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.1,
});

/**
 * Processes user input to formulate and store a feature request
 * @param state Current graph state
 * @returns Updated state with feature request information
 */
export const featureRequestAgent = async (state: GraphState): Promise<AgentResponse> => {
  // Get all user messages in the current conversation
  const userMessages = state.messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n");
  
  try {
    // Extract feature request details from user messages
    const response = await llm.invoke([
      {
        role: "system",
        content: `You are a feature request specialist. Your job is to extract details about a user's feature request, problem, or pain point.
          Format the information as a JSON object with the following structure:
          {
            "title": "Brief title for the feature request",
            "description": "Detailed description of the feature or problem",
            "userGoal": "What the user is trying to accomplish",
            "exampleUseCase": "A concrete example of how this feature would be used"
          }
          
          If any information is missing or unclear, make a reasonable inference based on what the user has shared.`
      },
      { role: "user", content: userMessages }
    ]);
    
    try {
      // Parse the JSON response
      const featureRequestText = response.content.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/)?.[1] || response.content;
      const featureRequestData: Omit<FeatureRequest, "timestamp"> = JSON.parse(featureRequestText);
      
      // Create a complete feature request with timestamp
      const featureRequest: FeatureRequest = {
        ...featureRequestData,
        timestamp: new Date()
      };
      
      // Add to the queue
      await addFeatureRequest(featureRequest);
      
      // Update agent state
      const updatedAgentState = {
        ...state.agentState,
        featureRequests: [...(state.agentState.featureRequests || []), featureRequest],
        taskCompleted: true,
        currentAgent: "PersonalAssistant"
      };
      
      return {
        messages: [
          ...state.messages,
          {
            role: "assistant", 
            content: `Thanks for your input! I've documented your request with the following details:
              
              **Title**: ${featureRequest.title}
              **Description**: ${featureRequest.description}
              **User Goal**: ${featureRequest.userGoal}
              **Example Use Case**: ${featureRequest.exampleUseCase}
              
              Your request has been added to our feature request queue. Is there anything else you'd like to share about this feature?`,
            agentName: "FeatureRequestAgent"
          }
        ],
        agentState: updatedAgentState
      };
    } catch (jsonError) {
      console.error("Error parsing feature request:", jsonError);
      
      return {
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: "I had trouble processing your feature request. Could you provide more details about what you're looking for?",
            agentName: "FeatureRequestAgent"
          }
        ],
        agentState: {
          ...state.agentState,
          taskCompleted: false
        }
      };
    }
  } catch (error) {
    console.error("Error in feature request agent:", error);
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "I encountered an issue while processing your feature request. Please try again.",
          agentName: "FeatureRequestAgent"
        }
      ],
      agentState: {
        ...state.agentState,
        taskCompleted: false
      }
    };
  }
};