const FALLBACK = 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.';

export function friendlyErrorMessage(error: unknown, fallback = FALLBACK): string {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = Number(candidate?.status ?? candidate?.code);
  if (status === 401 || candidate?.code === 'PGRST301') return 'Tu sesión venció. Volvé a ingresar e intentá de nuevo.';
  if (status === 403 || candidate?.code === '42501') return 'No tenés permiso para hacer esta acción.';
  if (status === 409 || candidate?.code === '23505') return 'Ya existe un registro con esos datos.';
  if (status === 400 || candidate?.code === '23502' || candidate?.code === '22P02') return 'Revisá los datos ingresados e intentá de nuevo.';
  return fallback;
}
