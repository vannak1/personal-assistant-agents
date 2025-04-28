// Define common types for the application

// Base state for all graph operations
export type GraphState = {
    messages: Message[];
    agentState: AgentState;
  };
  
  // Message object for communication between agents and user
  export type Message = {
    role: "user" | "assistant" | "system" | "agent";
    content: string;
    agentName?: string;
  };
  
  // Agent state tracking
  export type AgentState = {
    currentAgent: string;
    taskCompleted: boolean;
    featureRequests: FeatureRequest[];
    researchResults?: ResearchResult;
    redditSummary?: RedditSummary;
  };
  
  // Feature Request schema
  export type FeatureRequest = {
    title: string;
    description: string;
    userGoal: string;
    exampleUseCase: string;
    timestamp: Date;
  };
  
  // Deep Research schema
  export type ResearchResult = {
    question: string;
    answer: string;
    sources: string[];
  };
  
  // Reddit Summary schema
  export type RedditSummary = {
    topic: string;
    sentiment: "positive" | "negative" | "neutral" | "mixed";
    mainTopics: string[];
    topPosts: RedditPost[];
  };
  
  export type RedditPost = {
    title: string;
    url: string;
    upvotes: number;
    commentCount: number;
    summary: string;
  };
  
  // Return type for all agent operations
  export type AgentResponse = {
    messages: Message[];
    agentState: AgentState;
  };