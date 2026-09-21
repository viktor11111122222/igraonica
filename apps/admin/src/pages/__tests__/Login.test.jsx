import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }));

const login = vi.fn();

beforeEach(() => {
  login.mockReset().mockResolvedValue(undefined);
  useAuth.mockReturnValue({ login });
});

describe('Login', () => {
  test('logo nosi naziv za citace ekrana', () => {
    render(<Login />);
    expect(screen.getByAltText('Kids club')).toBeInTheDocument();
  });

  test('prijava salje email bez suvisnih razmaka', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText('Email'), '  admin@igraonica.com  ');
    await user.type(screen.getByLabelText('Lozinka'), 'admin1234');
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(login).toHaveBeenCalledWith('admin@igraonica.com', 'admin1234', false);
  });

  test('lozinka se ne vidi na ekranu', () => {
    render(<Login />);
    expect(screen.getByLabelText('Lozinka')).toHaveAttribute('type', 'password');
  });

  test('greska sa servera se prikazuje i dugme se otkljuca', async () => {
    login.mockRejectedValue(new Error('Pogresan email ili lozinka.'));
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText('Email'), 'admin@igraonica.com');
    await user.type(screen.getByLabelText('Lozinka'), 'lose');
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(await screen.findByText('Pogresan email ili lozinka.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prijavi se' })).toBeEnabled();
  });

  test('prazna forma se ne salje', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(login).not.toHaveBeenCalled();
  });
});

describe('Login - "Zapamti me"', () => {
  const KVACICA = /Zapamti me/i;

  test('kvacica nije unapred stiklirana na deljenom racunaru', () => {
    render(<Login />);
    expect(screen.getByLabelText(KVACICA)).not.toBeChecked();
  });

  test('stiklirana kvacica stize do prijave', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText('Email'), 'admin@igraonica.com');
    await user.type(screen.getByLabelText('Lozinka'), 'admin1234');
    await user.click(screen.getByLabelText(KVACICA));
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(login).toHaveBeenCalledWith('admin@igraonica.com', 'admin1234', true);
  });

  test('zapamcen email popunjava polje i vraca kvacicu', () => {
    localStorage.setItem('igraonica_admin_email', 'vicko@igraonica.com');

    render(<Login />);

    expect(screen.getByLabelText('Email')).toHaveValue('vicko@igraonica.com');
    expect(screen.getByLabelText(KVACICA)).toBeChecked();
  });

  // Polje za lozinku uvek krece prazno - pamti se samo email.
  test('lozinka se ne popunjava unapred', () => {
    localStorage.setItem('igraonica_admin_email', 'vicko@igraonica.com');

    render(<Login />);

    expect(screen.getByLabelText('Lozinka')).toHaveValue('');
  });
});
