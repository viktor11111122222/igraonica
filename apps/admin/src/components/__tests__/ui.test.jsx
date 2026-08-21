import { describe, test, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Alert,
  Badge,
  Confirm,
  Empty,
  Field,
  Modal,
  Pagination,
  SettingRow,
  Stepper,
  Switch,
} from '../ui';

describe('Modal - veza dugmadi sa formom', () => {
  // Podnozje modala je u DOM-u susedno telu, pa je dugme van <form> koja je u
  // telu. Bez `form={id}` pregledac preskace required/minLength/email.
  test('dugme iz podnozja se preko form={id} vezuje za formu iz tela', () => {
    render(
      <Modal
        title="Nesto"
        onClose={vi.fn()}
        footer={<button type="submit" form="f">Sacuvaj</button>}
      >
        <form id="f">
          <input required />
        </form>
      </Modal>
    );

    const dugme = screen.getByRole('button', { name: 'Sacuvaj' });
    expect(dugme.form).not.toBeNull();
    expect(dugme.form.id).toBe('f');
  });
});

describe('Modal - pristupacnost', () => {
  test('predstavlja se kao dijalog i nosi svoj naslov', () => {
    render(<Modal title="Izmena naloga" onClose={vi.fn()}>telo</Modal>);

    const dijalog = screen.getByRole('dialog');
    expect(dijalog).toHaveAttribute('aria-modal', 'true');
    expect(dijalog).toHaveAccessibleName('Izmena naloga');
  });

  test('fokus ulazi u dijalog pri otvaranju', async () => {
    render(
      <Modal title="Naslov" onClose={vi.fn()}>
        <input aria-label="polje" />
      </Modal>
    );

    const dijalog = screen.getByRole('dialog');
    expect(dijalog.contains(document.activeElement)).toBe(true);
  });

  test('fokus se vraca na dugme koje je otvorilo dijalog', async () => {
    const user = userEvent.setup();

    function Ekran() {
      const [otvoren, setOtvoren] = useState(false);
      return (
        <>
          <button onClick={() => setOtvoren(true)}>Otvori</button>
          {otvoren && (
            <Modal title="Naslov" onClose={() => setOtvoren(false)}>
              <input aria-label="polje" />
            </Modal>
          )}
        </>
      );
    }

    render(<Ekran />);
    const otvori = screen.getByRole('button', { name: 'Otvori' });
    await user.click(otvori);
    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(otvori);
  });

  // Bez zamke tab izadje na stranicu iza dijaloga, koja se ne vidi.
  test('tab kruzi unutar dijaloga', async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Naslov" onClose={vi.fn()} footer={<button>Poslednje</button>}>
        <input aria-label="polje" />
      </Modal>
    );

    const poslednje = screen.getByRole('button', { name: 'Poslednje' });
    poslednje.focus();
    await user.tab();

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});

describe('Modal - zatvaranje', () => {
  test('Escape zatvara', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Modal title="Naslov" onClose={onClose}>telo</Modal>);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  // Zatvaranje usred cuvanja bi ostavilo zahtev u vazduhu.
  test('dok traje cuvanje, Escape ne zatvara', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Modal title="Naslov" onClose={onClose} busy>telo</Modal>);

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  test('klik na podlogu zatvara, ali ne dok traje cuvanje', async () => {
    const onClose = vi.fn();
    const { rerender, container } = render(
      <Modal title="Naslov" onClose={onClose} busy>telo</Modal>
    );
    const podloga = container.querySelector('.modal-backdrop');

    podloga.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Modal title="Naslov" onClose={onClose}>telo</Modal>);
    podloga.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Confirm', () => {
  test('greska iz akcije stoji unutar dijaloga', () => {
    render(
      <Confirm
        title="Obrisati?"
        text="Trajno."
        error="Paket je vec dodeljen."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const dijalog = screen.getByRole('dialog');
    expect(dijalog).toHaveTextContent('Paket je vec dodeljen.');
  });

  test('bez greske nema prazne trake', () => {
    const { container } = render(
      <Confirm title="Obrisati?" text="Trajno." onConfirm={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.alert')).toBeNull();
  });

  test('dok traje akcija obe dugmadi su zakljucane', () => {
    render(
      <Confirm title="Obrisati?" text="Trajno." busy onConfirm={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Odustani' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sacekajte...' })).toBeDisabled();
  });
});

describe('Pagination', () => {
  test('sa jednom stranom prikazuje samo ukupno', () => {
    render(<Pagination page={1} pages={1} total={7} onChange={vi.fn()} />);
    expect(screen.getByText('Ukupno 7')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('bez ijednog rezultata ne crta nista', () => {
    const { container } = render(<Pagination page={1} pages={0} total={0} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('na prvoj strani nema nazad, na poslednjoj nema napred', () => {
    const { rerender } = render(<Pagination page={1} pages={3} total={50} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Prethodna' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sledeca' })).toBeEnabled();

    rerender(<Pagination page={3} pages={3} total={50} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Prethodna' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sledeca' })).toBeDisabled();
  });

  test('strelice menjaju stranu', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} pages={4} total={70} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Sledeca' }));
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Prethodna' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('Sitne komponente', () => {
  test('Alert bez sadrzaja ne crta traku', () => {
    const { container } = render(<Alert>{''}</Alert>);
    expect(container).toBeEmptyDOMElement();
  });

  test('Alert nosi ton u klasi', () => {
    const { container } = render(<Alert tone="ok">Gotovo</Alert>);
    expect(container.firstChild).toHaveClass('alert', 'ok');
  });

  test('Badge nosi ton u klasi', () => {
    const { container } = render(<Badge tone="green">5</Badge>);
    expect(container.firstChild).toHaveClass('badge', 'green');
  });

  test('Empty prikazuje naslov, tekst i akciju', () => {
    render(
      <Empty title="Prazno" text="Nema nicega">
        <button>Dodaj</button>
      </Empty>
    );
    expect(screen.getByText('Prazno')).toBeInTheDocument();
    expect(screen.getByText('Nema nicega')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj' })).toBeInTheDocument();
  });

  test('Field vezuje natpis i savet za polje', () => {
    render(
      <Field label="Ime" hint="Kako se zove">
        <input />
      </Field>
    );
    expect(screen.getByText('Ime')).toBeInTheDocument();
    expect(screen.getByText('Kako se zove')).toBeInTheDocument();
  });

  test('Switch javlja suprotnu vrednost i nosi stanje za citace ekrana', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked onChange={onChange} />);

    const prekidac = screen.getByRole('switch');
    expect(prekidac).toHaveAttribute('aria-checked', 'true');

    await user.click(prekidac);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('Stepper se krece po koraku i staje na granicama', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Stepper value="10" onChange={onChange} step={5} min={5} max={15} />
    );

    await user.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenCalledWith('15');

    await user.click(screen.getByRole('button', { name: '−' }));
    expect(onChange).toHaveBeenCalledWith('5');

    rerender(<Stepper value="15" onChange={onChange} step={5} min={5} max={15} />);
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
  });

  test('Stepper nudi precice za ceste vrednosti', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Stepper value="10" onChange={onChange} presets={[15, 30]} />);

    await user.click(screen.getByRole('button', { name: '30' }));
    expect(onChange).toHaveBeenCalledWith('30');
  });

  test('SettingRow pokazuje da je izmena sacuvana', () => {
    const { rerender } = render(
      <SettingRow label="Naziv" hint="Ime kluba" status="saving">
        <input />
      </SettingRow>
    );
    expect(screen.getByText('cuva se...')).toBeInTheDocument();

    rerender(
      <SettingRow label="Naziv" status="saved">
        <input />
      </SettingRow>
    );
    expect(screen.getByText('sacuvano ✓')).toBeInTheDocument();
  });
});
