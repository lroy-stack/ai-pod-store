'use client'

/**
 * CommandPalette - Keyboard-driven command palette (Cmd/Ctrl+K)
 *
 * Features:
 * - Opens with Cmd+K (macOS) or Ctrl+K (other platforms)
 * - Search functionality for products, pages, actions
 * - Quick navigation to common pages
 * - Responsive design with keyboard navigation
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Search,
  Home,
  ShoppingBag,
  Heart,
  Package,
  ShoppingCart,
  User,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CommandAction {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  category: 'navigation' | 'search' | 'action'
}

export function CommandPalette() {
  const t = useTranslations('commandPalette')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Define available commands
  const commands: CommandAction[] = [
    {
      id: 'home',
      label: t('home'),
      icon: <Home className="h-4 w-4" />,
      href: '/en',
      category: 'navigation',
    },
    {
      id: 'shop',
      label: t('shop'),
      icon: <ShoppingBag className="h-4 w-4" />,
      href: '/en/shop',
      category: 'navigation',
    },
    {
      id: 'favorites',
      label: t('favorites'),
      icon: <Heart className="h-4 w-4" />,
      href: '/en/wishlist',
      category: 'navigation',
    },
    {
      id: 'orders',
      label: t('orders'),
      icon: <Package className="h-4 w-4" />,
      href: '/en/orders',
      category: 'navigation',
    },
    {
      id: 'cart',
      label: t('cart'),
      icon: <ShoppingCart className="h-4 w-4" />,
      href: '/en/cart',
      category: 'navigation',
    },
    {
      id: 'profile',
      label: t('profile'),
      icon: <User className="h-4 w-4" />,
      href: '/en/profile',
      category: 'navigation',
    },
    {
      id: 'design',
      label: t('design'),
      icon: <Sparkles className="h-4 w-4" />,
      href: '/en/chat?prompt=design',
      category: 'action',
    },
  ]

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  )

  // Handle keyboard shortcuts to open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K on other platforms
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }

      // Escape to close
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectCommand = (command: CommandAction) => {
    router.push(command.href)
    setOpen(false)
  }

  // Handle keyboard navigation within palette
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          handleSelectCommand(selected)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredCommands, selectedIndex, handleSelectCommand])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('noResults')}
            </div>
          ) : (
            <div className="p-2">
              {filteredCommands.map((command, index) => (
                <Button
                  key={command.id}
                  variant="ghost"
                  onClick={() => handleSelectCommand(command)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 h-auto rounded-lg text-sm transition-colors justify-start',
                    'hover:bg-muted focus:bg-muted',
                    index === selectedIndex && 'bg-muted'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="text-muted-foreground">{command.icon}</div>
                  <span className="flex-1 text-left">{command.label}</span>
                  {command.category === 'action' && (
                    <span className="text-xs text-muted-foreground">
                      {t('action')}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>{t('navigate')}</span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              ↑↓
            </kbd>{' '}
            {t('select')}{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              ↵
            </kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
