export type SafeLogFields = Record<string, string | number | boolean | null>;

/** Emit only explicitly selected, non-sensitive fields; callers never pass raw errors or request data. */
export function logStructured(event: string, fields: SafeLogFields = {}): void {
  console.error(JSON.stringify({ event, ...fields }));
}
