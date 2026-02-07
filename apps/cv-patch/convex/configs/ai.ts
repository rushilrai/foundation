import { createOpenAI } from '@ai-sdk/openai'
import type { OpenAIProvider } from '@ai-sdk/openai';

export const OpenAIModels = {
  'gpt-5.2': 'gpt-5.2',
  'gpt-5.1': 'gpt-5.1',
} as const

export let openai: OpenAIProvider

export async function setupOpenAI() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY must be set')
    }

    openai = createOpenAI({
      apiKey: openaiApiKey,
    })
  } catch (error) {
    console.error('OpenAI setup failed', error)
    throw error
  }
}
