import * as dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { DynamicTool } from "@langchain/core/tools";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
  SystemMessage, // Import if needed, though not used in initial prompts here
} from "@langchain/core/messages";
import { StateGraph, MessageGraph, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import readline from "readline/promises";
import { RunnableLambda } from "@langchain/core/runnables";

// Load environment variables
dotenv.config();

// --- Configuration & Validation ---

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const LANGCHAIN_API_KEY = process.env.LANGCHAIN_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not found in environment variables.");
}
if (!TAVILY_API_KEY) {
  throw new Error("TAVILY_API_KEY not found in environment variables.");
}
if (!LANGCHAIN_API_KEY) {
  console.warn(
    "Warning: LANGCHAIN_API_KEY not found. Tracing to LangSmith/LangGraph Studio will be disabled."
  );
}

// --- LLM ---
// const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

// --- Tools ---

// 1. Deep Research Tool
const tavilyTool = new TavilySearchResults({ maxResults: 4, apiKey: TAVILY_API_KEY });
const researchTools = [tavilyTool];

// 2. Simulated Reddit Fetching Tool
const RedditFetchInputSchema = z.object({
  subreddit: z.string().describe("The subreddit to fetch from (e.g., 'wallstreetbets')."),
  topic: z.string().describe("The specific topic to search for (e.g., 'GME', 'GameStop')."),
  limit: z.number().default(10).describe("Approximate number of posts/comments to fetch."),
});

const simulateRedditGmeFetcherTool = new DynamicTool({
  name: "simulate_reddit_gme_fetcher",
  description:
    "Simulates fetching recent posts/comments about a specific topic (like GME) from a given subreddit (like wallstreetbets). Use this tool ONLY for GME/GameStop topics.",
  schema: RedditFetchInputSchema,
  func: async ({ subreddit, topic, limit }) => {
    console.log(
      `--- Simulating Reddit Fetch: r/${subreddit}, Topic: ${topic}, Limit: ${limit} ---`
    );
    if (!topic || !['gme', 'gamestop'].includes(topic.toLowerCase())) {
       return `This tool is currently focused on GME. Cannot fetch for ${topic}.`;
    }
    // Simulate data (same logic as Python example)
    const simulatedData = [
        {"author": "redditor1", "score": 150, "title": "GME to the moon again?", "body": "Just saw some unusual volume, anyone else thinking it's time?", "created_utc": 1678886400},
        {"author": "diamond_hands", "score": 50, "title": "Holding GME strong", "body": "Not selling my shares, fundamentals are strong.", "created_utc": 1678880000},
        {"author": "paper_trader", "score": -20, "title": "GME down again", "body": "Looks like the hype is over, might sell soon.", "created_utc": 1678870000},
        {"author": "ape_together", "score": 200, "body": "RC tweet analysis! What does it mean for GME?? 🚀🚀", "created_utc": 1678890000},
        {"author": "market_guru", "score": 5, "body": "GME sentiment seems mixed today, lots of volatility.", "created_utc": 1678888888},
    ];
    const repeatedData = Array(Math.ceil(limit / simulatedData.length)).fill(simulatedData).flat().slice(0, limit);
    return JSON.stringify(repeatedData);
  },
});

const redditTools = [simulateRedditGmeFetcherTool];

// --- Feature Request Queue (In-Memory) ---
interface FeatureRequestData {
  id: string;
  title: string;
  description: string;
  goals: string[];
  use_cases: string[];
}
const featureRequestQueue: FeatureRequestData[] = [];

// --- Agent State Definition ---
// Use MessageGraph for message accumulation
interface AgentState {
  messages: BaseMessage[];
  userInput: string; // Keep track of the latest raw user input if needed
  nextAgent: string; // Used by supervisor to route
}

const stateChannels = {
    messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
    },
    userInput: {
        value: (x: string, y: string) => y, // Always take the latest input
        default: () => "",
    },
    nextAgent: {
        value: (x: string, y: string) => y, // Latest decision wins
        default: () => "",
    },
};

// --- Agent Node Implementations ---

// 1. Supervisor Agent (Router)
const supervisorPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a supervisor agent acting as a personal assistant's central router.
Your goal is to understand the user's request and route it to the most appropriate specialized agent's starting node.
Do not answer the user's request directly, only decide which agent should handle it.

Available agents/starting nodes:
- feature_request_agent: Handles user feedback, problems, pain points, or feature ideas.
- research_agent: Handles complex, open-ended questions requiring research using search tools.
- gme_reddit_agent: Handles requests specifically about summarizing recent Reddit discussions about GameStop (GME).
- FINISH: Use this if the user wants to end the conversation, says goodbye, or if the task seems complete based on the conversation history.

Based on the user's latest message and the conversation history, determine the next agent/node to call.
Respond *only* with the name of the node (e.g., "research_agent", "feature_request_agent", "gme_reddit_agent", "FINISH").`,
  ],
  new MessagesPlaceholder("messages"),
]);

const supervisorChain = supervisorPrompt.pipe(llm);

const supervisorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  console.log("--- SUPERVISOR ---");
  const response = await supervisorChain.invoke({ messages: state.messages });
  let nextNodeName = response.content.toString().trim();
  console.log(`Routing decision: ${nextNodeName}`);

  const validNodes = ["feature_request_agent", "research_agent", "gme_reddit_agent", "FINISH"];
  if (!validNodes.includes(nextNodeName)) {
    console.warn(`Warning: Supervisor nominated invalid node '${nextNodeName}'. Defaulting to FINISH.`);
    nextNodeName = "FINISH";
  }

  return { nextAgent: nextNodeName };
};

// 2. Feature Request Agent
const FeatureRequestSchema = z.object({
  title: z.string().describe("A concise title for the feature request."),
  description: z.string().describe("A detailed description of the problem or idea."),
  goals: z.array(z.string()).describe("What this feature aims to achieve."),
  use_cases: z.array(z.string()).describe("Example scenarios where this feature would be used."),
});

const featureRequestPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are the Feature Request Agent.
Your task is to formulate a detailed feature request document based on the user's input.
Extract the core problem or idea and structure it into the following fields: title, description, goals, use_cases.
If the user's input is vague, you can ask clarifying questions, but for this step, try to formulate the best request possible based on the provided context.
Output *only* a JSON object matching the FeatureRequest schema. Do not add any introductory text or explanations.
Schema:
\`\`\`json
${JSON.stringify(FeatureRequestSchema.shape, null, 2)}
\`\`\``
  ],
  new MessagesPlaceholder("messages"), // Provide context
]);

// Use withStructuredOutput for reliable JSON based on Zod schema
const featureRequestChain = featureRequestPrompt.pipe(
    llm.withStructuredOutput(FeatureRequestSchema, { name: "FeatureRequest" })
);

const featureRequestNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  console.log("--- FEATURE REQUEST AGENT ---");
  // Use the most recent messages, especially the last human message
  const relevantMessages = state.messages.slice(-1); // Adjust if more context needed

  let outcomeMessage: string;
  try {
    const structuredOutput = await featureRequestChain.invoke({ messages: relevantMessages });
    const featureId = crypto.randomUUID(); // Use crypto for UUID in modern Node
    const featureData: FeatureRequestData = { id: featureId, ...structuredOutput };

    featureRequestQueue.push(featureData);
    console.log(`Feature Request Added to Queue: ${featureId}`);
    console.log(`Current Queue Size: ${featureRequestQueue.length}`);

    outcomeMessage = `OK, I've logged your feature request titled '${featureData.title}'. It's been added to our queue (ID: ${featureId}). Is there anything else I can help with?`;
  } catch (e) {
    console.error("Error in Feature Request Agent:", e);
    outcomeMessage = "Sorry, I had trouble formulating that feature request. Could you please try rephrasing?";
  }

  return { messages: [new AIMessage(outcomeMessage)] };
};

// 3. Deep Research Agent (ReAct Pattern)
const researchReactPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are the Deep Research Agent. Your goal is to answer the user's question thoroughly.
You have access to a search tool ('${tavilyTool.name}').
Think step-by-step:
1. Assess the user's question in the \`messages\`.
2. Decide if you need to use the search tool to gather information.
3. If yes, call the tool. Format your response as an AIMessage with \`tool_calls\`.
4. If no (you have enough information from the conversation history or previous tool calls), provide a final comprehensive answer to the user. Format your response as a regular AIMessage with the answer in the \`content\` field.
Do not make up information. If the search tool doesn't provide relevant info, state that.`
    ],
    new MessagesPlaceholder("messages"),
]);

// Bind the tool to the LLM
const llmWithResearchTools = llm.bindTools(researchTools);
// Create the runnable for a single agent step
const researchAgentRunnable = researchReactPrompt.pipe(llmWithResearchTools);

const researchAgentNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log("--- DEEP RESEARCH AGENT STEP ---");
    const agentResponse = await researchAgentRunnable.invoke({ messages: state.messages });
    console.log("Agent Response:", JSON.stringify(agentResponse.tool_calls ?? agentResponse.content, null, 2));
    // Return the AIMessage (which might contain tool_calls) to be added to the state.
    // The graph's conditional edge will route based on whether tool_calls exist.
    return { messages: [agentResponse] };
};

// ToolNode for executing research tools
const researchToolNode = new ToolNode<{messages: BaseMessage[]}>(researchTools);

// 4. GME Reddit Summary Agent (ReAct Pattern)
const redditReactPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are the GME Reddit Summary Agent. Your task is to summarize recent Reddit discussions about GameStop (GME).
You MUST use the '${simulateRedditGmeFetcherTool.name}' tool to get the data before summarizing.
Think step-by-step:
1. Check the conversation history (\`messages\`). Have you already fetched Reddit data for the current request?
2. If you need to fetch data, call the '${simulateRedditGmeFetcherTool.name}' tool. Provide 'subreddit' (e.g., 'wallstreetbets' or 'Superstonk'), 'topic' ('GME' or 'GameStop'), and 'limit'. Format as AIMessage with \`tool_calls\`.
3. If you have already fetched data (check for a recent \`ToolMessage\` with Reddit results), analyze the data and the user's request (e.g., specific interest like sentiment, trends, or general summary).
4. Provide a final summary based on the fetched data. Format as a regular AIMessage with the summary in the \`content\` field.
If the tool returns an error or no relevant data, state that in your final answer.`
    ],
    new MessagesPlaceholder("messages"),
]);

// Bind the tool to the LLM
const llmWithRedditTool = llm.bindTools(redditTools);
// Create the runnable for a single agent step
const redditAgentRunnable = redditReactPrompt.pipe(llmWithRedditTool);

const gmeRedditAgentNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log("--- GME REDDIT AGENT STEP ---");
    const agentResponse = await redditAgentRunnable.invoke({ messages: state.messages });
    console.log("Agent Response:", JSON.stringify(agentResponse.tool_calls ?? agentResponse.content, null, 2));
    // Return the AIMessage to be added to state. Routing depends on tool_calls.
    return { messages: [agentResponse] };
};

// ToolNode specifically for the Reddit tool
const redditToolNode = new ToolNode<{messages: BaseMessage[]}>(redditTools);


// --- Graph Definition ---
const workflow = new StateGraph<AgentState>({ channels: stateChannels });

// Add nodes
workflow.addNode("supervisor", new RunnableLambda({ func: supervisorNode })); // Wrap async functions
workflow.addNode("feature_request_agent", new RunnableLambda({ func: featureRequestNode }));
workflow.addNode("research_agent", new RunnableLambda({ func: researchAgentNode }));
workflow.addNode("research_tool_node", researchToolNode); // ToolNode is already runnable
workflow.addNode("gme_reddit_agent", new RunnableLambda({ func: gmeRedditAgentNode }));
workflow.addNode("reddit_tool_node", redditToolNode);

// Define edges

// Start with the supervisor
workflow.setEntryPoint("supervisor");

// Conditional routing from supervisor
workflow.addConditionalEdges(
    "supervisor",
    // Function to determine the route based on state.nextAgent
    (state: AgentState) => state.nextAgent,
    {
        "feature_request_agent": "feature_request_agent",
        "research_agent": "research_agent",
        "gme_reddit_agent": "gme_reddit_agent",
        "FINISH": END,
    }
);

// Feature request agent leads back to supervisor
workflow.addEdge("feature_request_agent", "supervisor");

// Deep Research Agent Loop (ReAct)
workflow.addConditionalEdges(
    "research_agent",
    toolsCondition, // Checks the last message for tool_calls
    {
        // If tool_calls exist, route to the tool node
        "tools": "research_tool_node",
        // Otherwise (no tool_calls, agent provided final answer), route back to supervisor
        "end": "supervisor"
    }
);
// After the tool node executes, route back to the agent node to process the result
workflow.addEdge("research_tool_node", "research_agent");


// GME Reddit Summary Agent Loop (ReAct)
workflow.addConditionalEdges(
    "gme_reddit_agent",
    toolsCondition, // Checks the last message for tool_calls
    {
        // If tool_calls exist, route to the tool node
        "tools": "reddit_tool_node",
        // Otherwise (final answer), route back to supervisor
        "end": "supervisor"
    }
);
// After the tool node executes, route back to the agent node
workflow.addEdge("reddit_tool_node", "gme_reddit_agent");


// Compile the graph
const app = workflow.compile();

// --- Graph Visualization (Optional) ---
// LangGraph JS doesn't have a built-in PNG/Mermaid exporter like Python yet.
// You can print the graph structure or use LangSmith for visualization.
console.log("\n--- Graph Structure (Connections) ---");
console.log(app.getGraph().toJSON()); // Prints the graph nodes and edges
console.log("------------------------------------\n");
console.log("View detailed runs and graph visualization in LangSmith:");
console.log(`https://smith.langchain.com/o/${process.env.LANGCHAIN_ORG_ID ?? 'YOUR_ORG'}/projects/p/${process.env.LANGCHAIN_PROJECT ?? 'YOUR_PROJECT_ID'}`); // Adjust if needed


// --- Running the System ---

const runConversation = async () => {
    console.log("Personal Assistant Initialized (TypeScript/ReAct). Type 'exit' to quit.");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let currentMessages: BaseMessage[] = [
        // Optional: Start with a system message if desired
        // new SystemMessage("Welcome! How can I assist you today?")
    ];
    const threadId = crypto.randomUUID(); // Example thread ID for potential persistence later
    const config = { configurable: { thread_id: threadId } }; // Needed for checkpointers if added

    while (true) {
        const userInput = await rl.question("You: ");
        if (userInput.toLowerCase() === "exit") {
            console.log("Assistant: Goodbye!");
            rl.close();
            break;
        }

        // Add user message to the list
        currentMessages.push(new HumanMessage(userInput));

        // Prepare inputs for the graph
        const inputs = { messages: currentMessages, userInput: userInput };

        console.log("\n--- Running Graph ---");
        try {
            const result = await app.invoke(inputs, config);
            console.log("--- Graph Run Complete ---");

            // Update message history from the final state
            currentMessages = result.messages;

            // Display the last AI message
            const lastMessage = currentMessages[currentMessages.length - 1];
            if (lastMessage && lastMessage._getType() === "ai") {
                console.log(`Assistant: ${lastMessage.content}`);
            } else if (lastMessage) {
                 // Fallback or indicate other state
                 console.log(`Assistant: [State: ${lastMessage._getType()}]`);
            } else {
                console.log("Assistant: [No response generated]");
            }

        } catch (error) {
            console.error("\nError during graph execution:", error);
            console.log("Assistant: Sorry, I encountered an error. Please try again.");
            // Optionally reset or rollback state here if using persistence
            // For simplicity, we'll just continue the loop
        }


        // Optional: Display feature request queue content
        console.log(`[Debug Info] Feature Queue Size: ${featureRequestQueue.length}`);
        // console.log(`[Debug Info] Messages: ${JSON.stringify(currentMessages)}`);
        console.log("-" .repeat(30));
    }
};

// --- Main Execution ---
runConversation().catch((e) => {
    console.error("Unhandled error in conversation:", e);
    process.exit(1);
});