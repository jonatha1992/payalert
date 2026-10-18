import type { PaymentConnection } from './types';
import type { SyncResult } from './manualSync';

export interface AutomaticConnection extends PaymentConnection {
  lastSyncedAt: string | null;
}

export interface AutomaticSyncDependencies {
  listConnections(limit: number): Promise<AutomaticConnection[]>;
  syncConnection(connection: AutomaticConnection, since: string): Promise<SyncResult>;
  /** Milliseconds since Unix epoch, matching Date.now. */
  now?: () => number;
  maxConnections: number;
  budgetMs: number;
}

export interface AutomaticSyncResult {
  selected: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

const LOOKBACK_MS = 60 * 60_000;

export async function runAutomaticSync(dependencies: AutomaticSyncDependencies): Promise<AutomaticSyncResult> {
  const now = dependencies.now ?? Date.now;
  const deadline = now() + dependencies.budgetMs;
  const limit = Math.max(0, Math.floor(dependencies.maxConnections));
  const connections = await dependencies.listConnections(limit);
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const connection of connections.slice(0, limit)) {
    if (now() >= deadline) { skipped += 1; continue; }
    const cursor = connection.lastSyncedAt ? Date.parse(connection.lastSyncedAt) : NaN;
    const since = new Date(Math.max(Number.isFinite(cursor) ? cursor : now() - LOOKBACK_MS,
      now() - LOOKBACK_MS)).toISOString();
    try {
      await dependencies.syncConnection(connection, since);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { selected: Math.min(connections.length, limit), succeeded, failed, skipped };
}
