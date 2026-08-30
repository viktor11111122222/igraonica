// Slanje na zakljucan ekran ide preko Expo servisa; ovde se proverava sve sem
// samog Expo-a - da li se salje pravim ljudima, sta se salje i sta se desava
// kad uredjaj vise ne postoji.
process.env.PUSH_ENABLED = 'true';
process.env.EXPO_PUSH_URL = 'https://push.test/send';

const { posalji } = require('../src/services/push');
const { prisma, cleanDB, createTestUser, disconnectDB } = require('./setup');

let saTokenom;
let bezTokena;

const odgovorOk = (data = []) => ({
  ok: true,
  status: 200,
  json: async () => ({ data }),
});

beforeAll(async () => {
  await cleanDB();
  saTokenom = await createTestUser({
    email: 'sa.tokenom@primer.rs',
    password: 'tajna123',
    firstName: 'Sa',
    lastName: 'Tokenom',
  });
  bezTokena = await createTestUser({
    email: 'bez.tokena@primer.rs',
    password: 'tajna123',
    firstName: 'Bez',
    lastName: 'Tokena',
  });

  await prisma.user.update({
    where: { id: saTokenom.id },
    data: { pushToken: 'ExponentPushToken[uredjaj-1]' },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await cleanDB();
  await disconnectDB();
});

const zapis = (userId, over = {}) => ({
  userId,
  type: 'CHILD_CHECKED_IN',
  title: 'Dete je u igraonici',
  body: 'Marko je prijavljen u 09:15.',
  data: { childId: 'c1' },
  ...over,
});

describe('Slanje push obavestenja', () => {
  test('salje samo korisnicima koji imaju uredjaj', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(odgovorOk());

    const rezultat = await posalji([zapis(saTokenom.id), zapis(bezTokena.id)]);

    expect(rezultat.poslato).toBe(1);
    const [, opcije] = fetchMock.mock.calls[0];
    const poslate = JSON.parse(opcije.body);
    expect(poslate).toHaveLength(1);
    expect(poslate[0].to).toBe('ExponentPushToken[uredjaj-1]');
  });

  test('poruka nosi naslov, tekst i podatke obavestenja', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(odgovorOk());

    await posalji([zapis(saTokenom.id)]);

    const [poruka] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(poruka).toMatchObject({
      title: 'Dete je u igraonici',
      body: 'Marko je prijavljen u 09:15.',
      data: { childId: 'c1' },
    });
  });

  test('bez ijednog uredjaja se ne salje nista', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(odgovorOk());

    const rezultat = await posalji([zapis(bezTokena.id)]);

    expect(rezultat.poslato).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Uredjaj sa kog je aplikacija obrisana bi inace zauvek primao poruke u
  // prazno, a Expo bi taj token na kraju blokirao.
  test('token uredjaja koji vise ne postoji se brise', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(odgovorOk([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]));

    await posalji([zapis(saTokenom.id)]);

    const posle = await prisma.user.findUnique({ where: { id: saTokenom.id } });
    expect(posle.pushToken).toBeNull();

    // vrati za ostale testove
    await prisma.user.update({
      where: { id: saTokenom.id },
      data: { pushToken: 'ExponentPushToken[uredjaj-1]' },
    });
  });

  test('greska servisa se javlja pozivaocu, koji je guta', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(posalji([zapis(saTokenom.id)])).rejects.toThrow('Expo push');
  });
});

// Dok kredencijali nisu podeseni, slanje mora da miruje - inace bi svaki poziv
// isao u prazno i usporavao radnju povodom koje nastaje.
describe('Ugaseno slanje', () => {
  test('bez PUSH_ENABLED se ne dira mreza', async () => {
    process.env.PUSH_ENABLED = 'false';
    const fetchMock = jest.spyOn(global, 'fetch');

    const rezultat = await posalji([zapis(saTokenom.id)]);

    expect(rezultat.poslato).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.PUSH_ENABLED = 'true';
  });
});
