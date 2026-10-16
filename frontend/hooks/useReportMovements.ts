'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReportQuery } from '@/lib/reports/query';

export interface Movement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  category: string | null;
  store_id: string;
  created_at: string;
  status: string | null;
  provider: string | null;
  currency: string | null;
  connection_id: string | null;
  stores?: { name: string };
}

interface MovementResult {
  transactions: Movement[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface MovementFilters extends Omit<ReportQuery, 'page' | 'pageSize'> {
  startDate: string;
  endDate: string;
  storeId: string;
  type: 'all' | 'income' | 'expense';
  category: string;
}

const INITIAL_FILTERS: MovementFilters = {
  startDate: '', endDate: '', storeId: '', type: 'all', category: '',
};

export function useReportMovements(businessId?: string) {
  const [filters, setFilters] = useState<MovementFilters>(INITIAL_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [data, setData] = useState<MovementResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page: number) => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ businessId, page: String(page), pageSize: '50' });
      for (const [key, value] of Object.entries({ ...filters, search: searchDraft })) {
        if (value !== '' && value !== 'all' && value !== undefined) params.set(key, String(value));
      }
      const response = await fetch(`/api/reports/movements?${params}`);
      if (!response.ok) throw new Error('Error al cargar movimientos');
      setData(await response.json());
    } finally {
      setLoading(false);
    }
  }, [businessId, filters, searchDraft]);

  useEffect(() => { void load(1); }, [load]);

  const exportCsv = useCallback(() => {
    if (!businessId) return;
    const params = new URLSearchParams({ businessId, format: 'csv' });
    for (const [key, value] of Object.entries({ ...filters, search: searchDraft })) {
      if (value !== '' && value !== 'all' && value !== undefined) params.set(key, String(value));
    }
    window.location.assign(`/api/reports/movements?${params}`);
  }, [businessId, filters, searchDraft]);

  return { filters, setFilters, searchDraft, setSearchDraft, data, loading, load, exportCsv };
}
