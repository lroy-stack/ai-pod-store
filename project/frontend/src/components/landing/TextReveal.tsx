'use client'

import { motion, useReducedMotion } from 'motion/react'
import { WORD_REVEAL } from '@/hooks/useMotionConfig'

interface TextRevealProps {
  text: string
  className?: string
  as?: 'h1' | 'h2' | 'p'
  delay?: number
}

export function TextReveal({ text, className, as: Tag = 'h1', delay = 0 }: TextRevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <Tag className={className}>{text}</Tag>
  }

  // Split by ". " to keep each sentence on its own line
  const sentences = text.split(/(?<=\.)\s+/)

  // Pre-compute word indices without mutation during render
  let offset = 0
  const sentenceData = sentences.map((sentence) => {
    const words = sentence.split(' ')
    const startIndex = offset
    offset += words.length
    return { sentence, words, startIndex }
  })

  return (
    <Tag className={className}>
      {sentenceData.map(({ words, startIndex }, sIdx) => (
        <span key={sIdx} style={{ display: 'block' }}>
          {words.map((word, wIdx) => (
            <motion.span
              key={`${word}-${startIndex + wIdx}`}
              variants={WORD_REVEAL}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
                delay: delay + (startIndex + wIdx) * 0.08,
              }}
              style={{ display: 'inline-block', marginRight: '0.3em' }}
            >
              {word}
            </motion.span>
          ))}
        </span>
      ))}
    </Tag>
  )
}
