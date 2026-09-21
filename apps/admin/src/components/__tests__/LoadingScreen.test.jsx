import { describe, test, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import LoadingScreen from '../LoadingScreen';
import { useMinimalniBoot } from '../../hooks/useMinimalniBoot';

vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }));

describe('LoadingScreen', () => {
  test('citacu ekrana kaze da se ceka', () => {
    render(<LoadingScreen />);
    const ekran = screen.getByRole('status');
    expect(ekran).toHaveAccessibleName('Ucitavanje');
  });

  // Logo je ukras pored poruke koju citac vec izgovara, pa se ne opisuje jos
  // jednom - prazan alt ga sklanja iz citanja.
  test('logo se ne cita dvaput', () => {
    render(<LoadingScreen />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('useMinimalniBoot', () => {
  function Proba() {
    return <span data-testid="stanje">{String(useMinimalniBoot(700))}</span>;
  }

  test('na pocetku jos nije proslo, pa posle praga jeste', async () => {
    vi.useFakeTimers();
    try {
      render(<Proba />);
      expect(screen.getByTestId('stanje')).toHaveTextContent('false');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
      });
      expect(screen.getByTestId('stanje')).toHaveTextContent('true');
    } finally {
      vi.useRealTimers();
    }
  });
});
