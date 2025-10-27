import { Agent } from '@openai/agents';
import { financeAgentContext } from '../../prompts/financeAgentContext';
import { model_names } from '../../utils';
import { agentCoreTools, agentCoreConfig } from './agentCoreTools';

/**
 * Finance Agent using AWS SDK AgentCore Approach
 *
 * Uses the AWS Bedrock AgentCore SDK (InvokeAgentRuntimeCommand) to invoke
 * tools hosted on the MCP server running on AgentCore.
 *
 * Configuration via environment variables:
 * - AWS_REGION: AWS region (default: eu-west-1)
 * - AGENT_RUNTIME_ARN: ARN of the AgentCore runtime
 * - AGENT_QUALIFIER: Runtime qualifier (default: DEFAULT)
 * - AWS_ACCOUNT_ID: AWS account ID
 */

export const financeAgent = async (): Promise<Agent> => {
  try {
    console.log('🚀 [Finance Agent] Starting initialization...');
    console.log('📋 [Finance Agent] Configuration:', {
      region: agentCoreConfig.region,
      runtimeArn: agentCoreConfig.runtimeArn,
      qualifier: agentCoreConfig.qualifier,
      accountId: agentCoreConfig.accountId,
      toolCount: agentCoreTools.length,
      tools: agentCoreTools.map((t) => t.name),
    });

    console.log(
      '🤖 [Finance Agent] Creating Agent instance with AgentCore SDK tools...'
    );
    const agent = new Agent({
      name: 'Finance Agent',
      model: model_names['4.1'],
      instructions: financeAgentContext,
      tools: agentCoreTools, // ← Tools that invoke AgentCore via AWS SDK
    });

    console.log(
      '✅ [Finance Agent] Finance Agent initialized successfully with AWS AgentCore SDK'
    );
    return agent;
  } catch (error) {
    console.error('❌ [Finance Agent] Error creating finance agent:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * Cleanup function for graceful shutdown
 * Note: No cleanup needed with AgentCore SDK approach (stateless)
 */
export const closeFinanceAgent = async () => {
  console.log('✅ [Finance Agent] No cleanup needed (stateless AWS SDK)');
};
