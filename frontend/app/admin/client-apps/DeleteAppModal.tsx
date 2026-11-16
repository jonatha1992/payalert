'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FormField } from '@/components/FormField';
import { friendlyErrorMessage } from '@/lib/ui/errorMessage';
import { toast } from 'sonner';

type App = { id: string; slug: string };

export function DeleteAppModal({ app, onClose, onDeleted }: { app: App; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/client-apps/${app.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'No pudimos eliminar la app.');
      onClose();
      toast.success(body.archived ? 'App archivada porque tiene cobros' : 'App eliminada');
      await onDeleted();
    } catch (cause) {
      const message = friendlyErrorMessage(cause, 'No se pudo eliminar la app vinculada.');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={`Eliminar ${app.slug}`} className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Eliminar {app.slug}</h2><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div><div className="space-y-4"><p className="text-sm text-gray-600 dark:text-gray-300">Escribí <strong>{app.slug}</strong> para confirmar. Si tiene cobros, se archivará en lugar de eliminarse.</p><FormField label="Slug de la app" name="confirm-slug" value={slug} onChange={setSlug} onBlur={() => undefined} />{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 dark:border-gray-700">Cancelar</button><button type="button" disabled={slug !== app.slug || saving} onClick={() => void confirm()} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><Trash2 size={16} />{saving ? 'Eliminando…' : 'Eliminar app'}</button></div></div></div></div>;
}
