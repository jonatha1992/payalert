export const SIDEBAR_STORAGE_KEY = 'payalert:sidebar-collapsed';

export function readCollapsedState(value: string | null): boolean {
  return value === 'true';
}
