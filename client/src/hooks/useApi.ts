/**
 * React hook for API calls
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient, ApiResponse } from '@/lib/api';

interface UseApiOptions {
  immediate?: boolean;
}

export function useApi<T>(
  endpoint: string,
  options: UseApiOptions = { immediate: true }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    const response = await apiClient.get<T>(endpoint);
    
    if (response.error) {
      setError(response.error);
      setData(null);
    } else {
      setData(response.data || null);
      setError(null);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (options.immediate) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, options.immediate]);

  return { data, loading, error, refetch: fetchData };
}
