'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Shield, RefreshCw, Lock, Truck } from 'lucide-react'
import { FADE_UP, STAGGER_CONTAINER, STAGGER_ITEM } from '@/hooks/useMotionConfig'

const TRUST_ITEMS = [
  { icon: Shield, key: 'trustMadeInEU' },
  { icon: RefreshCw, key: 'trustReturns' },
  { icon: Lock, key: 'trustSecure' },
  { icon: Truck, key: 'trustShipping' },
] as const

export function TrustBar() {
  const t = useTranslations('landing')

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={STAGGER_CONTAINER}
      className="px-6 py-12 md:py-16"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {TRUST_ITEMS.map(({ icon: Icon, key }) => (
            <motion.div
              key={key}
              variants={STAGGER_ITEM}
              className="flex flex-col items-center text-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {t(key)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
