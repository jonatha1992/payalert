import { describe, expect, it } from 'vitest';
import { readCollapsedState, SIDEBAR_STORAGE_KEY } from '../lib/sidebarState';

describe('sidebar collapsed state', () => {
  it('defaults to expanded when storage has no value', () => {
    expect(readCollapsedState(null)).toBe(false);
  });

  it('restores the persisted collapsed value', () => {
    expect(readCollapsedState('true')).toBe(true);
    expect(readCollapsedState('false')).toBe(false);
  });

  it('uses a stable storage key', () => {
    expect(SIDEBAR_STORAGE_KEY).toBe('payalert:sidebar-collapsed');
  });
});
