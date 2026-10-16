'use client';

import { useCallback, useEffect, useState } from 'react';

export interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
};

export function useNotificationPreferences(businessId?: string) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/notification-preferences?businessId=${encodeURIComponent(businessId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No pudimos cargar las preferencias.');
        const data = await response.json();
        if (active) setPreferences(data.preferences);
      })
      .catch((error) => {
        console.error('Error fetching notification preferences:', error);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  const update = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!businessId || key === 'emailEnabled') return;
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaving(true);
    try {
      const response = await fetch(`/api/notification-preferences?businessId=${encodeURIComponent(businessId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error('No pudimos guardar la preferencia.');
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (error) {
      setPreferences(previous);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [businessId, preferences]);

  return { preferences, loading, saving, update };
}
