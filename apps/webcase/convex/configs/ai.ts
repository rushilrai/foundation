import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'

// gpt-5.6-luna must be referenced by its full id: the bare 'gpt-5.6' alias
// routes to Sol, not Luna. gpt-6-luna is the only model the Decisions API
// serves.
export const OpenAIModels = {
  'gpt-5.6-luna': 'gpt-5.6-luna',
  'gpt-6-luna': 'gpt-6-luna',
} as const

export const DEFAULT_REASONING_EFFORT = 'low'

let openai: OpenAIProvider | null = null

// The OpenAI provider, or null when OPENAI_API_KEY is missing. Every AI step
// treats null as "skip": saving a link must never depend on AI.
export const getOpenAI = (): OpenAIProvider | null => {
  if (openai) {
    return openai
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set; AI features are off')
    return null
  }

  openai = createOpenAI({ apiKey })

  return openai
}
