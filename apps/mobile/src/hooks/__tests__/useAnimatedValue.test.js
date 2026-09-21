import { render, screen, act } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import { useAnimatedValue } from '../useAnimatedValue';

// React Native izvozi svoj `useAnimatedValue`, ali ga react-native-web nema -
// zbog toga je web build pucao cim bi render dosao do bilo kog dugmeta. Ovaj
// hook je zamena, pa mora da radi i kada modul nije nativni.
function Proba({ pocetna, beleg }) {
  const v = useAnimatedValue(pocetna);
  // `__getValue` je jedini nacin da se vrednost procita sinhrono u testu.
  return (
    <Text testID="stanje">
      {`${beleg}:${v instanceof Animated.Value}:${v.__getValue()}`}
    </Text>
  );
}

const stanje = () => screen.getByTestId('stanje').props.children;

describe('useAnimatedValue', () => {
  test('vraca Animated.Value sa zadatom pocetnom vrednoscu', async () => {
    await act(async () => {
      render(<Proba pocetna={1} beleg="a" />);
    });
    expect(stanje()).toBe('a:true:1');
  });

  test('radi i sa nulom', async () => {
    await act(async () => {
      render(<Proba pocetna={0} beleg="a" />);
    });
    expect(stanje()).toBe('a:true:0');
  });

  // Da se pravi nova vrednost pri svakom renderu, animacija bi se prekidala i
  // vracala na pocetak cim se komponenta ponovo iscrta. Provera ide kroz
  // ponasanje: vrednost se pomeri, pa mora da prezivi ponovni render.
  test('ista vrednost prezivljava ponovni render', async () => {
    const pomereno = [];

    function Cuvar({ beleg }) {
      const v = useAnimatedValue(1);
      pomereno.push(v);
      return <Text testID="stanje">{`${beleg}:${v.__getValue()}`}</Text>;
    }

    await act(async () => {
      render(<Cuvar beleg="a" />);
    });

    await act(async () => {
      pomereno[0].setValue(0.5);
    });
    await act(async () => {
      screen.rerender(<Cuvar beleg="b" />);
    });

    // Nova vrednost bi se vratila na 1.
    expect(stanje()).toBe('b:0.5');
  });

  // Pocetna vrednost se cita samo jednom: animacija u toku ne sme da skoci
  // zato sto je roditelj prosledio drugi broj.
  test('promena pocetne vrednosti ne resetuje animaciju', async () => {
    function Menjac({ pocetna }) {
      const v = useAnimatedValue(pocetna);
      return <Text testID="stanje">{String(v.__getValue())}</Text>;
    }

    await act(async () => {
      render(<Menjac pocetna={1} />);
    });
    await act(async () => {
      screen.rerender(<Menjac pocetna={99} />);
    });

    expect(stanje()).toBe('1');
  });

  test('dve komponente dobijaju svoje vrednosti', async () => {
    function Par() {
      const a = useAnimatedValue(1);
      const b = useAnimatedValue(2);
      return <Text testID="stanje">{`${a !== b}:${a.__getValue()}:${b.__getValue()}`}</Text>;
    }

    await act(async () => {
      render(<Par />);
    });
    expect(stanje()).toBe('true:1:2');
  });
});
