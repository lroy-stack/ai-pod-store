import type { Variants } from 'motion/react'

export const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}

export const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

export const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

export const SCALE_IN: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
}

export const WORD_REVEAL: Variants = {
  hidden: { clipPath: 'inset(-10% 100% -10% 0)' },
  visible: {
    clipPath: 'inset(-10% 0% -10% 0)',
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
}
