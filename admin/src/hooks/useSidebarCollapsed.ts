'use client';

import { useState, useEffect } from 'react';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Mark as client-side after hydration
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (isClient) {
      localStorage.setItem('admin-sidebar-collapsed', String(newState));
    }
  };

  return { collapsed, toggleCollapsed, isClient };
}
