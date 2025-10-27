import { Agent } from '@openai/agents';
import { synthesizerContext } from '../../prompts';
import { model_names } from '../../utils';

export const synthesizerAgent = () =>
  new Agent({
    name: 'Synthesizer Agent',
    model: model_names['4.1'],
    instructions: synthesizerContext,
  });
