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

  // Promena putanje (pretraga, strana, filter) vraca stanje na "ucitava se" i
  // brise staru gresku. To se radi u renderu, ne u effect-u: inace bi postojao
  // prolaz u kom se nova strana crta sa starom greskom ispod nje.
  const [zaPutanju, setZaPutanju] = useState(path);
  if (path !== zaPutanju) {
    setZaPutanju(path);
    setLoading(true);
    setError('');
  }

  useEffect(() => {
    let alive = true;
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
