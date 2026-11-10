import { MotionGlobalConfig } from 'motion'

// motion 12 finished animations instantly for visitors who prefer reduced
// motion; motion 14 no longer does, so opt back in here
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  MotionGlobalConfig.instantAnimations = true
}

export * from 'motion'
