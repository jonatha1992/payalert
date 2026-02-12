// Hook para manejar operaciones con Optimistic Updates
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimisticState<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
}

interface UseOptimisticCRUDOptions<T> {
  onError?: (error: Error, item: T) => void;
  onSuccess?: (item: T) => void;
  showToast?: boolean;
}

export function useOptimisticCRUD<T extends { id: string }>(
  initialData: T[] = [],
  options: UseOptimisticCRUDOptions<T> = {}
) {
  const { onError, onSuccess, showToast = true } = options;
  
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  });

  // Crear item con optimistic update
  const createOptimistic = useCallback(async (
    newItem: Omit<T, 'id'>,
    serverAction: () => Promise<T>
  ) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...newItem, id: tempId } as T;

    // 1. Actualizar UI inmediatamente
    setState(prev => ({
      ...prev,
      data: [optimisticItem, ...prev.data],
    }));

    try {
      // 2. Ejecutar acción en servidor
      const savedItem = await serverAction();

      // 3. Reemplazar item temporal con el real
      setState(prev => ({
        ...prev,
        data: prev.data.map(item => 
          item.id === tempId ? savedItem : item
        ),
      }));

      if (showToast) {
        toast.success('Creado exitosamente');
      }
      onSuccess?.(savedItem);
      return savedItem;

    } catch (error) {
      // 4. Rollback en caso de error
      setState(prev => ({
        ...prev,
        data: prev.data.filter(item => item.id !== tempId),
        error: error instanceof Error ? error.message : 'Error desconocido',
      }));

      if (showToast) {
        toast.error('Error al crear');
      }
      onError?.(error instanceof Error ? error : new Error('Error desconocido'), optimisticItem);
      throw error;
    }
  }, [onError, onSuccess, showToast]);

  // Actualizar item con optimistic update
  const updateOptimistic = useCallback(async (
    id: string,
    updates: Partial<T>,
    serverAction: () => Promise<T>
  ) => {
    // 1. Guardar estado anterior
    const previousItem = state.data.find(item => item.id === id);
    if (!previousItem) return;

    // 2. Actualizar UI inmediatamente
    setState(prev => ({
      ...prev,
      data: prev.data.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ),
    }));

    try {
      // 3. Ejecutar acción en servidor
      const updatedItem = await serverAction();

      // 4. Confirmar actualización
      setState(prev => ({
        ...prev,
        data: prev.data.map(item => 
          item.id === id ? updatedItem : item
        ),
      }));

      if (showToast) {
        toast.success('Actualizado exitosamente');
      }
      onSuccess?.(updatedItem);
      return updatedItem;

    } catch (error) {
      // 5. Rollback en caso de error
      setState(prev => ({
        ...prev,
        data: prev.data.map(item => 
          item.id === id ? previousItem : item
        ),
        error: error instanceof Error ? error.message : 'Error desconocido',
      }));

      if (showToast) {
        toast.error('Error al actualizar');
      }
      onError?.(error instanceof Error ? error : new Error('Error desconocido'), previousItem);
      throw error;
    }
  }, [state.data, onError, onSuccess, showToast]);

  // Eliminar item con optimistic update
  const deleteOptimistic = useCallback(async (
    id: string,
    serverAction: () => Promise<void>
  ) => {
    // 1. Guardar item y remover de UI
    const deletedItem = state.data.find(item => item.id === id);
    if (!deletedItem) return;

    setState(prev => ({
      ...prev,
      data: prev.data.filter(item => item.id !== id),
    }));

    try {
      // 2. Ejecutar acción en servidor
      await serverAction();

      if (showToast) {
        toast.success('Eliminado exitosamente');
      }

    } catch (error) {
      // 3. Restaurar item en caso de error
      setState(prev => ({
        ...prev,
        data: [...prev.data, deletedItem],
        error: error instanceof Error ? error.message : 'Error desconocido',
      }));

      if (showToast) {
        toast.error('Error al eliminar');
      }
      onError?.(error instanceof Error ? error : new Error('Error desconocido'), deletedItem);
      throw error;
    }
  }, [state.data, onError, showToast]);

  // Setear datos manualmente
  const setData = useCallback((data: T[]) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    createOptimistic,
    updateOptimistic,
    deleteOptimistic,
    setData,
  };
}
