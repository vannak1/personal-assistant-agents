import { ChatOpenAI } from "@langchain/openai";
import { GraphState, RedditSummary, RedditPost, AgentResponse } from "../types";
import { fetchRedditPosts } from "../tools/redditApi";

// Initialize the language model
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.2,
});

/**
 * Fetches and summarizes GME-related content from Reddit
 * @param state Current graph state
 * @returns Updated state with Reddit summary
 */
export const gmeRedditSummaryAgent = async (state: GraphState): Promise<AgentResponse> => {
  // Extract parameters from user message if any (e.g., specific subreddits or focus areas)
  const latestUserMessage = state.messages
    .filter(m => m.role === "user")
    .slice(-1)[0]?.content || "";
  
  try {
    // Determine what aspects of GME Reddit content the user is interested in
    const focusResponse = await llm.invoke([
      {
        role: "system",
        content: `You are a Reddit analysis specialist. Based on the user's message, determine:
          1. Which subreddits to focus on (default to "wallstreetbets", "stocks", "GME", "Superstonk" if not specified)
          2. What specific aspects the user is interested in (e.g., sentiment, DD analysis, memes, specific news)
          3. Time frame of interest (default to "latest" if not specified)
          
          Format your response as a JSON object:
          {
            "subreddits": ["sub1", "sub2"],
            "aspects": ["aspect1", "aspect2"],
            "timeFrame": "string description of time frame"
          }`
      },
      { role: "user", content: latestUserMessage }
    ]);
    
    // Parse the response
    const focusText = focusResponse.content.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/)?.[1] || focusResponse.content;
    const focus = JSON.parse(focusText);
    
    // Fetch posts from Reddit
    const redditPosts = await fetchRedditPosts(focus.subreddits, focus.timeFrame);
    
    // Analyze the posts with the LLM
    const analysisResponse = await llm.invoke([
      {
        role: "system",
        content: `You are a Reddit content analyst specializing in stock market discussions, particularly GameStop (GME).
          Analyze the provided Reddit posts and create a summary that focuses on: ${focus.aspects.join(", ")}.
          
          Format your response as a JSON object:
          {
            "sentiment": "positive" | "negative" | "neutral" | "mixed",
            "mainTopics": ["topic1", "topic2", "topic3"],
            "summary": "Overall summary of the findings",
            "topPostsSummaries": [
              {"title": "post title", "summary": "brief summary of post and key comments"}
            ]
          }`
      },
      { 
        role: "user", 
        content: `Reddit Posts:\n${JSON.stringify(redditPosts, null, 2)}` 
      }
    ]);
    
    // Parse the analysis
    const analysisText = analysisResponse.content.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/)?.[1] || analysisResponse.content;
    const analysis = JSON.parse(analysisText);
    
    // Format top posts for the RedditSummary type
    const topPosts: RedditPost[] = redditPosts.slice(0, 5).map((post, i) => ({
      title: post.title,
      url: post.url,
      upvotes: post.upvotes,
      commentCount: post.commentCount,
      summary: analysis.topPostsSummaries[i]?.summary || "No summary available"
    }));
    
    // Create the Reddit summary
    const redditSummary: RedditSummary = {
      topic: "GameStop (GME)",
      sentiment: analysis.sentiment,
      mainTopics: analysis.mainTopics,
      topPosts: topPosts
    };
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: `Here's the latest on GME from Reddit:
          
          **Overall Sentiment**: ${analysis.sentiment}
          
          **Main Topics of Discussion**:
          ${analysis.mainTopics.map(topic => `- ${topic}`).join('\n')}
          
          **Summary**:
          ${analysis.summary}
          
          **Top Posts**:
          ${topPosts.map(post => `- [${post.title}](${post.url}) (${post.upvotes} upvotes): ${post.summary}`).join('\n\n')}
          
          Would you like more details on any specific aspect?`,
          agentName: "GmeRedditSummaryAgent"
        }
      ],
      agentState: {
        ...state.agentState,
        redditSummary: redditSummary,
        taskCompleted: true,
        currentAgent: "PersonalAssistant"
      }
    };
  } catch (error) {
    console.error("Error in GME Reddit summary agent:", error);
    
    return {
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "I encountered an issue while fetching the latest GME information from Reddit. This could be due to API rate limits or connectivity issues. Would you like me to try again or focus on a specific aspect?",
          agentName: "GmeRedditSummaryAgent"
        }
      ],
      agentState: {
        ...state.agentState,
        taskCompleted: false
      }
    };
  }
};