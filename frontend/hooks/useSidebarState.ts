'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { readCollapsedState, SIDEBAR_STORAGE_KEY } from '@/lib/sidebarState';

let collapsedSnapshot: boolean | null = null;
const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => collapsedListeners.delete(listener);
}

function getCollapsedSnapshot() {
  return collapsedSnapshot ?? false;
}

function getServerCollapsedSnapshot() {
  return false;
}

export function useSidebarState() {
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, getServerCollapsedSnapshot);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const restoredValue = readCollapsedState(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
    collapsedSnapshot = restoredValue;
    collapsedListeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    collapsedSnapshot = collapsed;
    return () => document.documentElement.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    collapsedSnapshot = !getCollapsedSnapshot();
    collapsedListeners.forEach((listener) => listener());
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobile]);

  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, closeMobile };
}
