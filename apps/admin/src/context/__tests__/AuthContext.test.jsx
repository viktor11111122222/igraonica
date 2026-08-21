import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { get, post, setToken, getToken, onSessionExpired } from '../../lib/api';

// ApiError mora da ostane prava klasa - AuthContext je poziva sa `new`.
vi.mock('../../lib/api', async () => {
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn(),
    onSessionExpired: vi.fn(() => () => {}),
  };
});

const ADMIN = { id: 'a1', firstName: 'Vicko', lastName: 'Vicko', role: 'ADMIN' };
const RODITELJ = { id: 'r1', firstName: 'Ana', lastName: 'Petrovic', role: 'PARENT' };

function Ekran() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="stanje">
        {loading ? 'ucitava' : user ? `prijavljen:${user.role}` : 'odjavljen'}
      </div>
      <button onClick={() => login('a@b.c', 'tajna').catch((e) => {
        document.getElementById('greska').textContent = e.message;
      })}>Prijavi</button>
      <button onClick={logout}>Odjavi</button>
      <div id="greska" />
    </div>
  );
}

const prikazi = () => render(<AuthProvider><Ekran /></AuthProvider>);
const stanje = () => screen.getByTestId('stanje').textContent;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  setToken.mockReset();
  getToken.mockReset().mockReturnValue(null);
  onSessionExpired.mockReset().mockReturnValue(() => {});
});

describe('AuthContext - pokretanje', () => {
  test('bez tokena odmah zavrsava ucitavanje', async () => {
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    expect(get).not.toHaveBeenCalled();
  });

  // Rola je mogla da se promeni od poslednje prijave, pa je izvor istine server.
  test('sa tokenom pita server ko je korisnik', async () => {
    getToken.mockReturnValue('token');
    get.mockResolvedValue({ user: ADMIN });

    prikazi();

    await waitFor(() => expect(stanje()).toBe('prijavljen:ADMIN'));
    expect(get).toHaveBeenCalledWith('/auth/me');
  });

  test('roditeljski token se odbacuje', async () => {
    getToken.mockReturnValue('token');
    get.mockResolvedValue({ user: RODITELJ });

    prikazi();

    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    expect(setToken).toHaveBeenCalledWith(null);
  });

  test('neispravan token se brise', async () => {
    getToken.mockReturnValue('pokvaren');
    get.mockRejectedValue(new Error('Nevazeci token.'));

    prikazi();

    await waitFor(() => expect(setToken).toHaveBeenCalledWith(null));
    expect(stanje()).toBe('odjavljen');
  });
});

describe('AuthContext - prijava', () => {
  test('admin prolazi i token se cuva', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ token: 'nov-token', user: ADMIN });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() => expect(stanje()).toBe('prijavljen:ADMIN'));
    expect(setToken).toHaveBeenCalledWith('nov-token');
  });

  // Backend bi ga odbio na svakoj ruti sa 403; ovde se odbija odmah i jasno.
  test('roditelj ne moze u admin panel', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ token: 'nov-token', user: RODITELJ });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));

    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() =>
      expect(document.getElementById('greska').textContent).toBe(
        'Ovaj nalog nema administratorska prava.'
      )
    );
    expect(stanje()).toBe('odjavljen');
    expect(setToken).not.toHaveBeenCalledWith('nov-token');
  });
});

describe('AuthContext - odjava', () => {
  test('odjava brise token i korisnika', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ token: 't', user: ADMIN });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));
    await waitFor(() => expect(stanje()).toBe('prijavljen:ADMIN'));

    await user.click(screen.getByRole('button', { name: 'Odjavi' }));

    expect(stanje()).toBe('odjavljen');
    expect(setToken).toHaveBeenLastCalledWith(null);
  });

  // Ovo je bio kvar: istekao token niko nije hvatao, pa je svaka stranica
  // pokazivala gresku dok se localStorage ne obrise rukom.
  test('istekla sesija sama vraca na prijavu', async () => {
    let javiIstek;
    onSessionExpired.mockImplementation((fn) => {
      javiIstek = fn;
      return () => {};
    });
    const user = userEvent.setup();
    post.mockResolvedValue({ token: 't', user: ADMIN });
    prikazi();
    await waitFor(() => expect(stanje()).toBe('odjavljen'));
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));
    await waitFor(() => expect(stanje()).toBe('prijavljen:ADMIN'));

    act(() => javiIstek());

    expect(stanje()).toBe('odjavljen');
  });
});
