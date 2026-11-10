import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'

// gpt-5.6-luna must be referenced by its full id — the bare 'gpt-5.6' alias
// routes to Sol, not Luna.
export const OpenAIModels = {
  'gpt-5.6-luna': 'gpt-5.6-luna',
} as const

export const DEFAULT_REASONING_EFFORT = 'medium'

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
