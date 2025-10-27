import 'dotenv/config';
import express, { Request, Response } from 'express';
import { run, setDefaultOpenAIKey, withTrace, Tool } from '@openai/agents';
import { synthesizerAgent, orchestratorAgent } from './agents';
import { financeAgent, closeFinanceAgent } from './agents/financeAgent';
import cors from 'cors';

const app = express();
const port = 8080;

// Add JSON body parsing middleware
app.use(cors());
app.use(express.json());

// Initialize orchestrator tools at startup
let orchestratorTools: Tool[] = [];
let financeAgentInstance: any = null; // Store the agent instance for use in tool

const initializeTools = async () => {
  try {
    console.log('Initializing orchestrator tools...');

    // Initialize the finance agent
    // Use environment variable or default to localhost for local development
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:8000';
    console.log(
      `Initializing Finance Agent with MCP server at: ${mcpServerUrl}`
    );
    financeAgentInstance = await financeAgent();

    const financeAgentTool = await financeAgentInstance.asTool({
      toolName: 'query_car_financing',
      toolDescription:
        'Use this tool to answer questions about car financing, including calculating monthly payments, determining affordability, finding available financing options, and providing information about interest rates, loan terms, and financing requirements. This tool has access to car financing data and can help customers understand their financing options.',
    });
    orchestratorTools.push(financeAgentTool);

    console.log('✓ Finance Agent tool initialized successfully');
  } catch (error) {
    console.error('Failed to initialize orchestrator tools:', error);
    // Continue without tools rather than crashing the server
    orchestratorTools = [];
  }
};

// Start tool initialization immediately
const toolsPromise = initializeTools();

// Conversation history storage
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ticketNumber: string;
}

// In-memory conversation history organized by ticket number
// (in production, consider using a database with session management)
const conversationHistoryByTicket = new Map<string, ConversationMessage[]>();

// Optional: Limit history to prevent memory issues (keep last N messages per ticket)
const MAX_HISTORY_LENGTH = 50;

function addToHistory(
  ticketNumber: string,
  role: 'user' | 'assistant',
  content: string
) {
  // Get or create history array for this ticket
  if (!conversationHistoryByTicket.has(ticketNumber)) {
    conversationHistoryByTicket.set(ticketNumber, []);
  }

  const ticketHistory = conversationHistoryByTicket.get(ticketNumber)!;

  ticketHistory.push({
    role,
    content,
    timestamp: new Date(),
    ticketNumber,
  });

  // Trim history if it gets too long
  if (ticketHistory.length > MAX_HISTORY_LENGTH) {
    ticketHistory.splice(0, ticketHistory.length - MAX_HISTORY_LENGTH);
  }
}

function getConversationContext(ticketNumber: string): string {
  const ticketHistory = conversationHistoryByTicket.get(ticketNumber);

  if (!ticketHistory || ticketHistory.length === 0) {
    return '';
  }

  return (
    ticketHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n') + '\n'
  );
}

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

// Health check endpoint for AWS AgentCore
app.get('/ping', async (req: Request, res: Response) => {
  try {
    // Check if tools are initialized
    const toolsInitialized = orchestratorTools.length > 0;

    // Check if finance agent is available
    const financeAgentAvailable = financeAgentInstance !== null;

    // Determine health status
    const isHealthy = toolsInitialized && financeAgentAvailable;

    // Check if currently processing (you can enhance this with actual processing state)
    const isProcessing = false; // This can be set to true when handling requests

    const status = isHealthy
      ? isProcessing
        ? 'HealthyBusy'
        : 'Healthy'
      : 'Unhealthy';

    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      details: {
        toolsInitialized,
        toolCount: orchestratorTools.length,
        financeAgentAvailable,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'Unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// New endpoint to get conversation history for a specific ticket
app.get('/history', (req: Request, res: Response) => {
  const { ticketNumber } = req.query;

  // Validate ticketNumber is provided
  if (!ticketNumber || typeof ticketNumber !== 'string') {
    res.status(400).json({
      error: 'ticketNumber query parameter is required and must be a string',
    });
    return;
  }

  const ticketHistory = conversationHistoryByTicket.get(ticketNumber) || [];

  res.json({
    ticketNumber,
    history: ticketHistory,
    count: ticketHistory.length,
  });
});

// New endpoint to clear conversation history
app.delete('/history', (req: Request, res: Response) => {
  const { ticketNumber } = req.query;

  if (ticketNumber && typeof ticketNumber === 'string') {
    // Clear specific ticket history
    conversationHistoryByTicket.delete(ticketNumber);
    res.json({
      message: `Conversation history cleared for ticket ${ticketNumber}`,
    });
  } else {
    // Clear all history
    conversationHistoryByTicket.clear();
    res.json({ message: 'All conversation history cleared' });
  }
});

app.post('/invocations', async (req: Request, res: Response) => {
  console.log('🔍 [Main] POST /prompt request received', req.body, res);
  // Extract message and ticketNumber from request body
  const { message, ticketNumber } = req.body;

  // Validate that message is provided
  if (!message || typeof message !== 'string') {
    res.writeHead(400, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'Message is required and must be a string',
      })}\n\n`
    );
    res.end();
    return;
  }

  // Validate that ticketNumber is provided
  if (!ticketNumber || typeof ticketNumber !== 'string') {
    res.writeHead(400, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'ticketNumber is required and must be a string',
      })}\n\n`
    );
    res.end();
    return;
  }

  // Get conversation context for this ticket and add to the user message
  const conversationContext = getConversationContext(ticketNumber);
  const contextualMessage = conversationContext
    ? `Previous conversation:\n${conversationContext}\n\nCurrent message: ${message}`
    : message;

  // Add user message to history for this ticket
  addToHistory(ticketNumber, 'user', message);

  // Set up Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  setDefaultOpenAIKey(process.env.OPENAI_API_KEY!);

  try {
    // Wait for tools to be initialized before processing request
    await toolsPromise;

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        message: 'Agent connected successfully',
      })}\n\n`
    );

    // Initialize orchestrator with available tools
    const orchestratorAgentMain = orchestratorAgent(orchestratorTools);

    let assistantResponse: string = '';

    await withTrace('Orchestrator evaluator', async () => {
      const orchestrator = await run(orchestratorAgentMain, contextualMessage);
      for (const item of orchestrator.newItems) {
        if (item.type === 'message_output_item') {
          const text = item.content;
          if (text) {
            // Optionally stream orchestration steps here
            res.write(
              `data: ${JSON.stringify({ type: 'step', content: text })}\n\n`
            );
          }
        }
      }

      const synthesizerResult = await run(
        synthesizerAgent(),
        orchestrator.output
      );

      assistantResponse = (synthesizerResult.finalOutput ??
        'No response generated') as string;

      // Add assistant response to history for this ticket
      addToHistory(ticketNumber, 'assistant', assistantResponse);

      // Send final result in SSE format
      res.write(
        `data: ${JSON.stringify({
          type: 'result',
          content: assistantResponse,
        })}\n\n`
      );
      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    // Add error to history as well for this ticket
    addToHistory(ticketNumber, 'assistant', `Error: ${errorMessage}`);
    res.write(
      `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
    );
  } finally {
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Car Sales Agent Server listening on port ${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    await closeFinanceAgent();
    console.log('✓ Finance Agent cleaned up successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
