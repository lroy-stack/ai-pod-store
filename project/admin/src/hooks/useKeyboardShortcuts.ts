import { useEffect, useCallback, useRef, useState } from 'react';

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  category?: string;
  disabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook to register and manage keyboard shortcuts
 * Supports j/k navigation, Enter to open, Escape to close
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  preventDefault = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't interfere with input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Find matching shortcut
      const shortcut = shortcutsRef.current.find(
        (s) => s.key.toLowerCase() === event.key.toLowerCase() && !s.disabled
      );

      if (shortcut) {
        if (preventDefault) {
          event.preventDefault();
        }
        shortcut.action();
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Hook for managing row navigation (j/k pattern)
 */
export interface UseRowNavigationOptions {
  rowCount: number;
  onSelect?: (index: number) => void;
  onOpen?: (index: number) => void;
  enabled?: boolean;
  initialIndex?: number;
}

export function useRowNavigation({
  rowCount,
  onSelect,
  onOpen,
  enabled = true,
  initialIndex = -1,
}: UseRowNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'j',
      description: 'Move down',
      category: 'Navigation',
      action: () => {
        setSelectedIndex((prev) => {
          const next = prev + 1 >= rowCount ? prev : prev + 1;
          onSelect?.(next);
          return next;
        });
      },
      disabled: selectedIndex >= rowCount - 1,
    },
    {
      key: 'k',
      description: 'Move up',
      category: 'Navigation',
      action: () => {
        setSelectedIndex((prev) => {
          const next = prev - 1 < 0 ? 0 : prev - 1;
          onSelect?.(next);
          return next;
        });
      },
      disabled: selectedIndex <= 0,
    },
    {
      key: 'Enter',
      description: 'Open selected',
      category: 'Navigation',
      action: () => {
        if (selectedIndex >= 0 && selectedIndex < rowCount) {
          onOpen?.(selectedIndex);
        }
      },
      disabled: selectedIndex < 0,
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled });

  return {
    selectedIndex,
    setSelectedIndex,
  };
}
