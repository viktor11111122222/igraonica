import { render, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useMinimalniBoot, useNajmanjeTrajanje } from '../useUcitavanje';

// `renderHook` se u ovoj verziji RNTL-a ponasa nepredvidivo (vraca prazan
// `result`), pa se hook gleda kroz sicusnu komponentu - isto kao drugde u
// projektu.
function Boot({ ms }) {
  return <Text testID="stanje">{String(useMinimalniBoot(ms))}</Text>;
}

function Radnja({ aktivno, ms }) {
  return <Text testID="stanje">{String(useNajmanjeTrajanje(aktivno, ms))}</Text>;
}

const stanje = () => screen.getByTestId('stanje').props.children;

const pomeri = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useMinimalniBoot', () => {
  test('na pocetku jos nije proslo', async () => {
    await act(async () => {
      render(<Boot ms={900} />);
    });
    expect(stanje()).toBe('false');
  });

  test('posle praga propusta dalje', async () => {
    await act(async () => {
      render(<Boot ms={900} />);
    });

    await pomeri(900);

    expect(stanje()).toBe('true');
  });

  // Poenta zajednickog pocetka: dve kapije (font i sesija) ne smeju da se
  // nadovezu, inace bi pokretanje trajalo dvostruko duze.
  test('druga kapija ne pocinje da broji ispocetka', async () => {
    await act(async () => {
      render(<Boot ms={900} />);
    });
    await pomeri(900);
    expect(stanje()).toBe('true');

    // Nov `key` montira novu instancu hooka - to je druga kapija.
    await act(async () => {
      screen.rerender(<Boot key="druga" ms={900} />);
    });

    // Vreme se meri od pokretanja aplikacije, a ono je vec odavno proslo.
    expect(stanje()).toBe('true');
  });
});

describe('useNajmanjeTrajanje', () => {
  test('mirno stanje je false', async () => {
    await act(async () => {
      render(<Radnja aktivno={false} ms={450} />);
    });
    expect(stanje()).toBe('false');
  });

  test('dok radnja traje, drzi se', async () => {
    await act(async () => {
      render(<Radnja aktivno ms={450} />);
    });
    expect(stanje()).toBe('true');
  });

  test('kratka radnja se produzava do praga', async () => {
    await act(async () => {
      render(<Radnja aktivno ms={450} />);
    });

    await pomeri(80);
    await act(async () => {
      screen.rerender(<Radnja aktivno={false} ms={450} />);
    });

    // Radnja je gotova, ali prag jos nije istekao - ekran ne sme da trepne.
    expect(stanje()).toBe('true');

    await pomeri(450);
    expect(stanje()).toBe('false');
  });

  // Spora mreza ne sme da dobije jos 450ms na vrh svog trajanja.
  test('duga radnja se ne produzava', async () => {
    await act(async () => {
      render(<Radnja aktivno ms={450} />);
    });

    await pomeri(3000);
    await act(async () => {
      screen.rerender(<Radnja aktivno={false} ms={450} />);
    });
    await pomeri(1);

    expect(stanje()).toBe('false');
  });
});
