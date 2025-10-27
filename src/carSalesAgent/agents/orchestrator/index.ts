import { Agent, Tool } from '@openai/agents';
import { orchestratorContext } from '../../prompts';
import { model_names } from '../../utils';

export const orchestratorAgent = (tools: Tool[]) =>
  new Agent({
    name: 'orchestrator_agent',
    model: model_names['4.1'],
    instructions: orchestratorContext,
    tools: tools,
  });
