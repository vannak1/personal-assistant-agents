import { ChatOpenAI } from "@langchain/openai";
import { GraphState, ResearchResult, AgentResponse } from "../types";
import { performResearch } from "../tools/researchTools";

// Initialize the language model
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.2,
});

/**
 * Handles complex research questions by gathering information from multiple sources
 * @param state Current graph state
 * @returns Updated state with research results
 */
export const deepResearchAgent = async (state: GraphState): Promise<AgentResponse> => {
  // Extract the research question from user messages
  const latestUserMessage = state.messages
    .filter(m => m.role === "user")
    .slice(-1)[0]?.content || "";
  
  try {
    // First, determine what we need to research
    const questionResponse = await llm.invoke([
      {
        role: "system",
        content: `You are a research specialist. Based on the user's message, formulate a clear research question.
          Keep the question focused and specific. Return only the research question without any additional text.`
      },
      { role: "user", content: latestUserMessage }
    ]);
    
    const researchQuestion = questionResponse.content.trim();
    
    // Perform the research using our research tools
    const sources = await performResearch(researchQuestion);
    
    // Send the sources to the LLM to synthesize an answer
    const synthesisResponse = await llm.invoke([
      {
        role: "system",
        content: `You are a research specialist. Synthesize the following sources to answer the question: "${researchQuestion}"
          Provide a comprehensive answer based only on the provided sources. Cite specific sources where appropriate.
          If the sources don't contain sufficient information to answer the question fully, acknowledge the limitations.`
      },
      { 
        role: "user", 
        content: `Research Sources:\n${sources.map((s, i) => `Source ${i+1}: ${s}`).join('\n\n')}` 
      }
    ]);
    
    // Create research result object
    const researchResult: ResearchResult = {
      question: researchQuestion,
      answer: synthesisResponse.content,
      sources: sources
    };
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: `Here's what I found regarding "${researchQuestion}":\n\n${synthesisResponse.content}\n\nMy research drew from ${sources.length} sources. Would you like more details on any specific aspect?`,
          agentName: "DeepResearchAgent"
        }
      ],
      agentState: {
        ...state.agentState,
        researchResults: researchResult,
        taskCompleted: true,
        currentAgent: "PersonalAssistant"
      }
    };
  } catch (error) {
    console.error("Error in deep research agent:", error);
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "I encountered an issue while researching your question. Would you mind rephrasing it or providing more context?",
          agentName: "DeepResearchAgent"
        }
      ],
      agentState: {
        ...state.agentState,
        taskCompleted: false
      }
    };
  }
};