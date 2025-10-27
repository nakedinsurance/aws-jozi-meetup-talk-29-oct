import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * AWS Bedrock AgentCore Tool Wrappers
 *
 * This module provides tool wrappers that invoke the MCP server hosted on
 * Bedrock AgentCore using the AWS SDK instead of the MCP client.
 *
 * NOTE: This approach assumes the AgentCore runtime is configured to accept
 * structured JSON requests that specify the tool name and arguments.
 *
 * If AgentCore expects natural language prompts instead, you'll need to
 * format the tool calls as natural language requests.
 */

// Configuration from environment variables
const AWS_REGION = process.env.AWS_REGION;
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;
const AGENT_QUALIFIER = process.env.AGENT_QUALIFIER || 'DEFAULT';
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

// Create AgentCore client
const client = new BedrockAgentCoreClient({
  region: AWS_REGION,
  // Credentials will be automatically loaded from environment or IAM role
});

/**
 * Generates a session ID that meets AgentCore requirements (33+ characters)
 * Generates a random string of lowercase letters, 45 characters long
 */
function generateSessionId(): string {
  const length = 45;
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz';

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

/**
 * Invokes the AgentCore runtime with a structured tool call request
 *
 * @param toolName - The name of the MCP tool to invoke
 * @param toolArguments - The arguments to pass to the tool
 * @returns The tool response as a string
 */
async function invokeAgentCoreTool(
  toolName: string,
  toolArguments: Record<string, any>
): Promise<string> {
  try {
    console.log(`🔧 [AgentCore Tools] Invoking tool: ${toolName}`, {
      toolArguments,
      timestamp: new Date().toISOString(),
    });

    // Filter out undefined and null values from toolArguments
    const cleanedArguments = Object.entries(toolArguments).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>
    );

    console.log(`🔧 [AgentCore Tools] Cleaned arguments:`, {
      cleanedArguments,
    });

    // Create a structured request that the AgentCore runtime can understand
    // APPROACH 1: Send as JSON-RPC MCP protocol format
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: cleanedArguments,
      },
    };

    // APPROACH 2: Send as natural language (alternative if Approach 1 doesn't work)
    // const naturalLanguageRequest = `Call the ${toolName} tool with the following arguments: ${JSON.stringify(toolArguments)}`;

    console.log(`📦 [AgentCore Tools] MCP Request Payload:`, {
      mcpRequest: JSON.stringify(mcpRequest),
    });

    // Convert to Uint8Array
    const payload = new TextEncoder().encode(JSON.stringify(mcpRequest));

    const sessionId = generateSessionId();
    console.log(`🔑 [AgentCore Tools] Generated session ID:`, {
      sessionId,
      length: sessionId.length,
    });

    const input = {
      runtimeSessionId: sessionId,
      agentRuntimeArn: AGENT_RUNTIME_ARN,
      qualifier: AGENT_QUALIFIER,
      payload: payload,
      contentType: 'application/json',
      // Accept both JSON and SSE formats (MCP supports both)
      accept: 'application/json, text/event-stream',
      mcpProtocolVersion: '2024-11-05',
    };

    console.log(`📤 [AgentCore Tools] Sending request to AgentCore`, {
      toolName,
      runtimeArn: AGENT_RUNTIME_ARN,
      region: AWS_REGION,
      sessionId,
    });

    console.log(`🔍 [AgentCore Tools] Input:`, {
      input,
    });
    const command = new InvokeAgentRuntimeCommand(input);
    const response = await client.send(command);

    if (!response.response) {
      throw new Error('No response received from AgentCore runtime');
    }

    // Transform the response stream to string
    const textResponse = await response.response.transformToString();

    console.log(`✅ [AgentCore Tools] Tool ${toolName} executed successfully`, {
      responseLength: textResponse.length,
    });

    // Parse the response - it might be JSON or plain text depending on AgentCore's format
    try {
      const jsonResponse = JSON.parse(textResponse);
      console.log(`🔍 [AgentCore Tools] JSON response:`, {
        jsonResponse,
      });
      return JSON.stringify(jsonResponse, null, 2);
    } catch {
      // If not JSON, return as-is
      return textResponse;
    }
  } catch (error) {
    console.error(`❌ [AgentCore Tools] Error invoking tool ${toolName}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(
      `Failed to invoke ${toolName}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Tool: add
 * Basic addition operation (example/test tool)
 */
export const addTool = tool({
  name: 'add',
  description: 'Add two numbers together',
  parameters: z.object({
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  async execute({ a, b }) {
    return await invokeAgentCoreTool('add', { a, b });
  },
});

/**
 * Tool: get_car_financing_data
 * Retrieves car financing application data with optional filters
 */
export const getCarFinancingDataTool = tool({
  name: 'get_car_financing_data',
  description:
    'Retrieve car financing application data. Can filter by application ID or outcome (SUCCESS/REJECTED). ' +
    'Returns detailed information about customer profiles, vehicle details, financing terms, and application outcomes.',
  parameters: z.object({
    applicationId: z
      .string()
      .optional()
      .nullable()
      .describe('Filter by specific application ID'),
    outcome: z
      .enum(['SUCCESS', 'REJECTED'])
      .optional()
      .nullable()
      .describe('Filter by application outcome'),
  }),
  async execute({ applicationId, outcome }) {
    console.log(`🔍 [AgentCore Tools] Executing tool: get_car_financing_data`, {
      applicationId,
      outcome,
    });

    const response = await invokeAgentCoreTool('get_car_financing_data', {
      applicationId,
      outcome,
    });

    console.log(
      `✅ [AgentCore Tools] Tool get_car_financing_data executed successfully`,
      {
        response,
      }
    );

    return response;
  },
});

/**
 * Tool: add_car_financing_data
 * Adds a new car financing application to the dataset
 */
export const addCarFinancingDataTool = tool({
  name: 'add_car_financing_data',
  description:
    'Add a new car financing application to the dataset. Requires complete application details including ' +
    'customer profile (credit score, income, down payment, etc.), vehicle information (make, model, year, price, etc.), ' +
    'and financing terms (loan amount, term length, APR, lender). The application must have a unique applicationId.',
  parameters: z.object({
    application: z.object({
      applicationId: z
        .string()
        .describe('Unique identifier for the application'),
      submissionDate: z.string().describe('ISO 8601 date format (YYYY-MM-DD)'),
      outcome: z.enum(['SUCCESS', 'REJECTED']).describe('Application outcome'),
      customer: z.object({
        creditScore: z
          .number()
          .min(300)
          .max(850)
          .describe('FICO credit score (300-850)'),
        annualIncomeZar: z.number().min(0).describe('Annual income in ZAR'),
        downPaymentZar: z
          .number()
          .min(0)
          .describe('Down payment amount in ZAR'),
        tradeInValueZar: z
          .number()
          .min(0)
          .describe('Trade-in vehicle value in ZAR'),
        debtToIncomeRatio: z
          .number()
          .min(0)
          .max(1)
          .describe('Debt to income ratio (0-1)'),
        applicantLocation: z
          .string()
          .describe('Geographic location (zip code or state)'),
      }),
      vehicle: z.object({
        make: z.string().describe('Vehicle manufacturer'),
        model: z.string().describe('Vehicle model'),
        year: z.number().describe('Model year'),
        msrpZar: z
          .number()
          .min(0)
          .describe('Manufacturer suggested retail price'),
        salePriceZar: z.number().min(0).describe('Final sale price'),
        mileage: z.number().min(0).describe('Current mileage'),
        condition: z.enum(['New', 'Used']).describe('Vehicle condition'),
      }),
      financing: z.object({
        loanAmountRequestedZar: z
          .number()
          .min(0)
          .describe('Requested loan amount'),
        termLengthMonths: z.number().min(1).describe('Loan term in months'),
        annualPercentageRate: z
          .number()
          .min(0)
          .max(1)
          .describe('APR as decimal (e.g., 0.059 for 5.9%)'),
        lenderId: z.string().describe('Lender identifier'),
      }),
      rejectionDetails: z
        .object({
          reason: z.string().describe('Rejection reason'),
          internalNotes: z
            .string()
            .optional()
            .nullable()
            .describe('Internal notes'),
        })
        .optional()
        .nullable()
        .describe('Required if outcome is REJECTED'),
    }),
  }),
  async execute({ application }) {
    return await invokeAgentCoreTool('add_car_financing_data', { application });
  },
});

/**
 * Export all tools as an array for easy integration with OpenAI Agents
 */
export const agentCoreTools = [
  addTool,
  getCarFinancingDataTool,
  addCarFinancingDataTool,
];

/**
 * Export configuration for reference
 */
export const agentCoreConfig = {
  region: AWS_REGION,
  runtimeArn: AGENT_RUNTIME_ARN,
  qualifier: AGENT_QUALIFIER,
  accountId: AWS_ACCOUNT_ID,
};
