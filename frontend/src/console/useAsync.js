import { useState, useCallback } from 'react';

export function useAsync() {
  const [state, setState] = useState({ data: null, loading: false, error: null });

  const run = useCallback(async (promise) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await promise;
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'An error occurred';
      setState({ data: null, loading: false, error: msg });
      throw err;
    }
  }, []);

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);

  return { ...state, run, reset };
}
