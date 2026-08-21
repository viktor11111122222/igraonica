import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetch } from '../useFetch';
import { get } from '../../lib/api';

vi.mock('../../lib/api', () => ({ get: vi.fn() }));

beforeEach(() => {
  get.mockReset();
});

describe('useFetch', () => {
  test('dovlaci podatke i gasi ucitavanje', async () => {
    get.mockResolvedValue({ users: [{ id: 'u1' }] });

    const { result } = renderHook(() => useFetch('/users'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ users: [{ id: 'u1' }] });
    expect(result.current.error).toBe('');
  });

  test('greska sa servera stize do pozivaoca', async () => {
    get.mockRejectedValue(new Error('Nema veze sa serverom.'));

    const { result } = renderHook(() => useFetch('/users'));

    await waitFor(() => expect(result.current.error).toBe('Nema veze sa serverom.'));
    expect(result.current.data).toBeNull();
  });

  // Ovo je bio kvar: traka sa starom greskom je ostajala i posle uspesnog
  // ucitavanja novih podataka.
  test('stara greska nestaje kada se putanja promeni', async () => {
    get.mockRejectedValueOnce(new Error('Pretraga nije uspela.'));

    const { result, rerender } = renderHook(({ path }) => useFetch(path), {
      initialProps: { path: '/users?search=xyz' },
    });
    await waitFor(() => expect(result.current.error).toBe('Pretraga nije uspela.'));

    get.mockResolvedValue({ users: [] });
    rerender({ path: '/users?search=ana' });

    await waitFor(() => expect(result.current.data).toEqual({ users: [] }));
    expect(result.current.error).toBe('');
  });

  test('promena putanje dovlaci ponovo', async () => {
    get.mockResolvedValue({ users: [] });

    const { rerender } = renderHook(({ path }) => useFetch(path), {
      initialProps: { path: '/users?page=1' },
    });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users?page=1'));

    rerender({ path: '/users?page=2' });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users?page=2'));
  });

  test('reload dovlaci ponovo i cisti gresku', async () => {
    get.mockRejectedValueOnce(new Error('Puklo.'));
    const { result } = renderHook(() => useFetch('/users'));
    await waitFor(() => expect(result.current.error).toBe('Puklo.'));

    get.mockResolvedValue({ users: [{ id: 'u2' }] });
    await act(() => result.current.reload());

    expect(result.current.error).toBe('');
    expect(result.current.data).toEqual({ users: [{ id: 'u2' }] });
  });

  // Odgovor koji stigne posle napustanja ekrana ne sme da dira stanje.
  test('odgovor posle demontiranja se ignorise', async () => {
    let razresi;
    get.mockReturnValue(new Promise((r) => { razresi = r; }));

    const { unmount } = renderHook(() => useFetch('/users'));
    unmount();

    await act(async () => {
      razresi({ users: [] });
    });
    // Bez `alive` zastite React bi ovde prijavio azuriranje demontirane
    // komponente; test prolazi tako sto se nista ne desi.
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('setData dozvoljava lokalnu izmenu bez novog zahteva', async () => {
    get.mockResolvedValue({ users: [] });
    const { result } = renderHook(() => useFetch('/users'));
    await waitFor(() => expect(result.current.data).toEqual({ users: [] }));

    act(() => result.current.setData({ users: [{ id: 'lokalno' }] }));

    expect(result.current.data).toEqual({ users: [{ id: 'lokalno' }] });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
