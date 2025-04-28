import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Reddit API credentials - in a real implementation, these would be in .env
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'personal-assistant-agent:v1.0';

// Type for Reddit API post response
type RedditPost = {
  title: string;
  url: string;
  permalink: string;
  author: string;
  created_utc: number;
  upvotes: number;
  commentCount: number;
  selftext: string;
};

/**
 * Fetches posts from specified subreddits
 * @param subreddits Array of subreddit names
 * @param timeFrame Time frame for posts (e.g., 'day', 'week', 'month')
 * @returns Array of Reddit posts
 */
export const fetchRedditPosts = async (
  subreddits: string[] = ['wallstreetbets', 'stocks', 'GME', 'Superstonk'],
  timeFrame: string = 'day'
): Promise<RedditPost[]> => {
  // For demonstration purposes, we're using mock data
  // In a real implementation, this would call the Reddit API
  
  // This simulates a Reddit API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock data
  return getMockRedditPosts(subreddits);
};

/**
 * Generates mock Reddit posts for demonstration
 * @param subreddits Subreddits to generate mock data for
 * @returns Array of mock Reddit posts
 */
const getMockRedditPosts = (subreddits: string[]): RedditPost[] => {
  const mockPosts: RedditPost[] = [
    {
      title: "GME Q1 Earnings Beat Expectations, Stock Up 8% in After Hours",
      url: "https://reddit.com/r/wallstreetbets/mock1",
      permalink: "/r/wallstreetbets/comments/mock1",
      author: "DiamondHands42069",
      created_utc: Date.now() / 1000 - 3600 * 5,
      upvotes: 4281,
      commentCount: 732,
      selftext: "GameStop just reported Q1 earnings with revenue of $1.38B vs $1.25B expected. EPS was $0.15 vs $0.02 expected. Their e-commerce sales are up 42% YoY. Looks like the turnaround is real! 🚀🚀🚀"
    },
    {
      title: "DD: GME's NFT Marketplace Strategy and Future Revenue Projections",
      url: "https://reddit.com/r/Superstonk/mock2",
      permalink: "/r/Superstonk/comments/mock2",
      author: "RoaringKitty22",
      created_utc: Date.now() / 1000 - 3600 * 12,
      upvotes: 2876,
      commentCount: 412,
      selftext: "I've analyzed GME's NFT marketplace strategy and projected potential revenue streams. Based on current growth and market trends, they could capture 15-20% of the gaming NFT market within 2 years. Full analysis in post..."
    },
    {
      title: "Ryan Cohen Just Purchased Another 100,000 Shares of GME",
      url: "https://reddit.com/r/GME/mock3",
      permalink: "/r/GME/comments/mock3",
      author: "ApeAnalyst",
      created_utc: Date.now() / 1000 - 3600 * 8,
      upvotes: 3542,
      commentCount: 621,
      selftext: "Breaking news: RC just filed that he purchased another 100K shares at an average price of $142.86. This brings his total to 9.1M shares or approximately 12% of outstanding shares. Bullish!"
    },
    {
      title: "GameStop Announces New Partnership with Major Game Publisher",
      url: "https://reddit.com/r/Superstonk/mock4",
      permalink: "/r/Superstonk/comments/mock4",
      author: "GMEtoTheMoon",
      created_utc: Date.now() / 1000 - 3600 * 18,
      upvotes: 1932,
      commentCount: 304,
      selftext: "GameStop just announced an exclusive partnership with [Major Publisher] to offer special edition collectibles and early access to upcoming releases. This is huge for building their brand value in the gaming community."
    },
    {
      title: "Technical Analysis: GME Set for Potential Breakout This Week",
      url: "https://reddit.com/r/wallstreetbets/mock5",
      permalink: "/r/wallstreetbets/comments/mock5",
      author: "ChartGuru",
      created_utc: Date.now() / 1000 - 3600 * 10,
      upvotes: 876,
      commentCount: 203,
      selftext: "Looking at the charts, GME is forming a clear bull flag pattern with increasing volume. MACD crossing over and RSI at 62 suggests momentum is building. We could see a test of $180 resistance soon if volume continues."
    }
  ];
  
  // Filter by requested subreddits if needed
  if (subreddits.length > 0 && subreddits[0] !== '') {
    const subredditSet = new Set(subreddits.map(s => s.toLowerCase()));
    return mockPosts.filter(post => {
      const postSubreddit = post.permalink.split('/')[2].toLowerCase();
      return subredditSet.has(postSubreddit);
    });
  }
  
  return mockPosts;
};