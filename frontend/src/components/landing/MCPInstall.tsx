'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// Configure NEXT_PUBLIC_MCP_BASE_URL in .env to set your MCP server URL
const MCP_URL = (process.env.NEXT_PUBLIC_MCP_BASE_URL || 'http://localhost:8002') + '/mcp'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

interface IntegrationCardProps {
  logoSrc: string
  logoAlt: string
  logoSize?: number
  name: string
  steps: string[]
  settingsUrl?: string
  settingsLabel?: string
  className?: string
}

function IntegrationCard({ logoSrc, logoAlt, logoSize = 24, name, steps, settingsUrl, settingsLabel, className }: IntegrationCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={logoSize}
            height={logoSize}
            className="object-contain"
          />
        </div>
        <span className="text-sm font-semibold text-foreground">{name}</span>
      </div>

      {/* Step-by-step instructions */}
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      {/* URL copy box */}
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
        <code className="text-xs flex-1 break-all select-all text-foreground">{MCP_URL}</code>
        <CopyButton text={MCP_URL} />
      </div>

      {/* Direct link to settings */}
      {settingsUrl && (
        <a
          href={settingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          {settingsLabel || 'Open settings'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

export function MCPInstall() {
  const t = useTranslations('landing')

  const claudeSteps = [
    t('mcpClaudeStep1'),
    t('mcpClaudeStep2'),
    t('mcpClaudeStep3'),
    t('mcpClaudeStep4'),
  ]

  const chatgptSteps = [
    t('mcpChatGPTStep1'),
    t('mcpChatGPTStep2'),
    t('mcpChatGPTStep3'),
  ]

  return (
    <section className="px-6 py-16 md:py-24 bg-muted/20">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t('mcpTitle')}
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
            {t('mcpSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IntegrationCard
            logoSrc="/brand/claude-ai-icon.webp"
            logoAlt="Claude"
            logoSize={22}
            name="Claude"
            steps={claudeSteps}
            settingsUrl="https://claude.ai/settings/connectors"
            settingsLabel={t('mcpOpenSettings')}
          />
          <IntegrationCard
            logoSrc="/brand/chatgpt-logo.svg"
            logoAlt="ChatGPT"
            logoSize={22}
            name="ChatGPT"
            steps={chatgptSteps}
            settingsUrl="https://chatgpt.com/settings"
            settingsLabel={t('mcpOpenSettings')}
          />
        </div>
      </div>
    </section>
  )
}
