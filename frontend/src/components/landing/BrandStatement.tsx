'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { FADE_UP, STAGGER_CONTAINER, STAGGER_ITEM } from '@/hooks/useMotionConfig'

const TAGS = ['CODE', 'DESIGN', 'FUTURE'] as const

export function BrandStatement() {
  const t = useTranslations('landing')

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={STAGGER_CONTAINER}
      className="px-6 py-16 md:py-24 bg-muted/20"
    >
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          variants={FADE_UP}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-foreground font-[family-name:var(--font-display)]"
        >
          {t('brandStatement')}
        </motion.h2>

        <motion.p
          variants={FADE_UP}
          className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed text-balance"
        >
          {t('brandBody')}
        </motion.p>

        <motion.div
          variants={FADE_UP}
          className="mt-8 flex items-center justify-center gap-3"
        >
          {TAGS.map((tag) => (
            <motion.div key={tag} variants={STAGGER_ITEM}>
              <Badge
                variant="outline"
                className="text-xs tracking-widest uppercase px-4 py-1.5 font-mono"
              >
                {tag}
              </Badge>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  )
}
