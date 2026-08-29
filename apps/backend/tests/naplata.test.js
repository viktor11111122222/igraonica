const { naplativiSati, naplativiMinuti } = require('../src/utils/naplata');

// Pravilo: naplacuje se u punim satima, minuti preko punog sata se opraštaju
// do praga, a preko praga povlace ceo sat. Najmanje jedan sat.
describe('naplativiSati - podrazumevani prag od 15 min', () => {
  const slucajevi = [
    [0, 1, 'dete je odmah izaslo'],
    [1, 1, 'jedan minut'],
    [10, 1, 'deset minuta'],
    [15, 1, 'tacno prag'],
    [16, 1, 'preko praga, ali jos u prvom satu'],
    [45, 1, 'pola sata i kusur'],
    [59, 1, 'minut do sata'],
    [60, 1, 'tacno sat'],
    [61, 1, 'sat i minut'],
    [70, 1, 'sat i deset'],
    [75, 1, 'sat i petnaest - prag nije PRESAO'],
    [76, 2, 'sat i sesnaest - presao prag, ide drugi sat'],
    [90, 2, 'sat i po'],
    [119, 2, 'minut do dva sata'],
    [120, 2, 'tacno dva sata'],
    [130, 2, 'dva sata i deset'],
    [135, 2, 'dva sata i petnaest'],
    [136, 3, 'dva sata i sesnaest'],
    [480, 8, 'ceo dan'],
    [481, 8, 'ceo dan i minut'],
  ];

  for (const [minuti, ocekivano, opis] of slucajevi) {
    test(`${minuti} min -> ${ocekivano} h (${opis})`, () => {
      expect(naplativiSati(minuti)).toBe(ocekivano);
    });
  }
});

describe('naplativiSati - prag se podesava', () => {
  test('prag 0 znaci da svaki zapoceti sat vec ide u naplatu', () => {
    expect(naplativiSati(60, 0)).toBe(1);
    expect(naplativiSati(61, 0)).toBe(2);
    expect(naplativiSati(120, 0)).toBe(2);
  });

  test('prag 30 oprasta pola sata', () => {
    expect(naplativiSati(90, 30)).toBe(1);
    expect(naplativiSati(91, 30)).toBe(2);
  });

  test('prag 59 oprasta sve sem poslednjeg minuta', () => {
    expect(naplativiSati(119, 59)).toBe(1);
    expect(naplativiSati(120, 59)).toBe(2);
  });

  // Prag stize iz podesavanja; ako u bazi zavrsi nesto neupotrebljivo, racunica
  // mora da radi po podrazumevanom umesto da vrati NaN.
  test('neupotrebljiv prag pada na 15', () => {
    expect(naplativiSati(70, NaN)).toBe(1);
    expect(naplativiSati(76, undefined)).toBe(2);
    expect(naplativiSati(70, 'abc')).toBe(1);
  });

  test('neupotrebljivo trajanje ne obara racunicu', () => {
    expect(naplativiSati(NaN)).toBe(1);
    expect(naplativiSati(-30)).toBe(1);
    expect(naplativiSati(null)).toBe(1);
  });

  // Sekunde ne smeju da preskoce prag: 15 min i 40 sekundi je jos 15 minuta.
  test('deo minuta se odbacuje, ne zaokruzuje', () => {
    expect(naplativiSati(15.9)).toBe(1);
    expect(naplativiSati(75.9)).toBe(1);
  });
});

describe('naplativiMinuti', () => {
  test('vraca isti racun izrazen u minutima', () => {
    expect(naplativiMinuti(10)).toBe(60);
    expect(naplativiMinuti(70)).toBe(60);
    expect(naplativiMinuti(76)).toBe(120);
    expect(naplativiMinuti(136)).toBe(180);
  });
});
