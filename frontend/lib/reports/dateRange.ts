const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function localDateBoundaryUtc(date: string, endOfDay = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha inválida');
  const [year, month, day] = date.split('-').map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0), 3));
  if (instant.toISOString().slice(0, 10) !== (endOfDay ? nextDate(date) : date)) throw new Error('Fecha inválida');
  return instant.toISOString();
}

function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function localDateKey(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
