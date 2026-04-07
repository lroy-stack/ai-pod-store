'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  key: string;
  description: string;
  category?: string;
}

interface KeyboardShortcutsHelpProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

const defaultShortcuts: Shortcut[] = [
  { key: 'j', description: 'Move down', category: 'Navigation' },
  { key: 'k', description: 'Move up', category: 'Navigation' },
  { key: 'Enter', description: 'Open selected item', category: 'Navigation' },
  { key: 'Escape', description: 'Close dialog/modal', category: 'Navigation' },
  { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { key: 'Cmd+K', description: 'Open command palette', category: 'General' },
];

export function KeyboardShortcutsHelp({
  open: controlledOpen,
  onOpenChange,
  trigger,
}: KeyboardShortcutsHelpProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  // Listen for ? key to open help
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Group shortcuts by category
  const groupedShortcuts = defaultShortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <>
      {trigger && (
        <div onClick={() => setOpen(true)} className="cursor-pointer">
          {trigger}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate and manage the admin panel efficiently
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Tip: Keyboard shortcuts work on all list pages (orders, products, customers, etc.)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Trigger button for mobile (when keyboard may not be available)
 */
export function KeyboardShortcutsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="p-2"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="h-5 w-5" />
      </Button>
      <KeyboardShortcutsHelp open={open} onOpenChange={setOpen} />
    </>
  );
}
