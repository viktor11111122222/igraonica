import { useCallback, useEffect, useState } from 'react';
import { get } from '../lib/api';

// Ucitavanje sa jednim reload-om. Kada se `path` promeni (pretraga, strana,
// filter), podaci se sami dovlace ponovo.
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      setData(await get(path));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    get(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, loading, error, reload, setData };
}
