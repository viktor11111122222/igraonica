import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckIn from '../CheckIn';
import { get, post } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

// Kamera ne postoji u testu; `start` zadrzava callback da test moze da
// "skenira" kad hoce.
const h = vi.hoisted(() => ({ onSuccess: null, start: vi.fn(), stop: vi.fn() }));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn(function FakeScanner() {
    return { start: h.start, stop: h.stop, clear: vi.fn() };
  }),
}));

const KOD = 'IGR-5424914B';

beforeEach(() => {
  h.onSuccess = null;
  h.start.mockReset().mockImplementation(async (cfg, opts, onSuccess) => {
    h.onSuccess = onSuccess;
  });
  h.stop.mockReset().mockResolvedValue(undefined);

  get.mockResolvedValue({ visits: [] });
  post.mockResolvedValue({ message: 'Ana Petrovic je prijavljen/a.', remainingHours: 12 });
});

async function ukljuciKameru(user) {
  await user.click(screen.getByRole('button', { name: 'Skeniraj kamerom' }));
  await waitFor(() => expect(h.start).toHaveBeenCalled());
}

describe('CheckIn - kamera', () => {
  test('kamera je iskljucena dok se ne trazi', async () => {
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));

    expect(h.start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Skeniraj kamerom' })).toBeInTheDocument();
  });

  test('dugme ukljucuje i gasi kameru', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);

    await ukljuciKameru(user);
    expect(screen.getByRole('button', { name: 'Ugasi kameru' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ugasi kameru' }));
    await waitFor(() => expect(h.stop).toHaveBeenCalled());
  });

  // Ovo je sustina: skeniran kod mora da pokrene isti poziv kao rucni unos.
  test('skeniran kod salje prijavu', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-in', { qrCode: KOD })
    );
  });

  test('u rezimu odjave skeniran kod salje odjavu', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);

    await user.click(screen.getByRole('button', { name: 'Odjava' }));
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-out', { qrCode: KOD })
    );
  });

  test('posle skeniranja se osvezava lista prisutnih', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);
    get.mockClear();

    await h.onSuccess(KOD);

    await waitFor(() => expect(get).toHaveBeenCalledWith('/visits/active'));
  });

  test('odgovor servera se prikazuje radniku', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    expect(await screen.findByText(/Ana Petrovic je prijavljen/)).toBeInTheDocument();
  });

  test('greska sa servera se prikazuje', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error('Dete je vec prijavljeno u igraonici.'));

    render(<CheckIn />);
    await ukljuciKameru(user);

    await h.onSuccess(KOD);

    expect(
      await screen.findByText('Dete je vec prijavljeno u igraonici.')
    ).toBeInTheDocument();
  });
});

describe('CheckIn - rucni unos ostaje', () => {
  test('kod unet rukom radi i bez kamere', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('IGR-XXXXXXXX'), KOD);
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/visits/check-in', { qrCode: KOD })
    );
    expect(h.start).not.toHaveBeenCalled();
  });

  test('polje se prazni posle uspesne prijave', async () => {
    const user = userEvent.setup();
    render(<CheckIn />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    const polje = screen.getByPlaceholderText('IGR-XXXXXXXX');
    await user.type(polje, KOD);
    await user.click(screen.getByRole('button', { name: 'Prijavi' }));

    await waitFor(() => expect(polje).toHaveValue(''));
  });
});
