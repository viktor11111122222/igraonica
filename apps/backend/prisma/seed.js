// Puni jelovnik i raspored primerima, da aplikacija ima sta da prikaze.
//
// Pokretanje:  npm run seed
//
// Skripta je idempotentna - moze da se pokrene vise puta:
//   - jelovnik se upsertuje po (datum, tip obroka),
//   - aktivnost se preskace ako vec postoji ista (dan + vreme + naziv).
// Postojeci podaci se ne brisu.
require('dotenv').config();

const prisma = require('../src/config/db');

// Datumi se drze UTC ponoci, isto kao u rutama (menu.js) - inace bi zapadno
// od Grinica isti kljuc pao na prethodni dan.
function toUtcDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function toKey(date) {
  return date.toISOString().split('T')[0];
}

// Ponedeljak tekuce nedelje. Backend racuna nedelju od ponedeljka, a
// dayOfWeek 0 = ponedeljak (ne JS konvencija gde je 0 = nedelja).
function mondayOfThisWeek() {
  const now = new Date();
  const utc = toUtcDate(toKey(now));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - (day === 0 ? 6 : day - 1));
  return utc;
}

// Jelovnik: sedam dana, cetiri obroka. Redosled prati MealType enum.
const MENU = [
  {
    BREAKFAST: ['Griz na mleku', 'Posut cimetom', null],
    SNACK_MORNING: ['Jabuka i banana', 'Sece se na kockice', null],
    LUNCH: ['Pileca supa i sarma', 'Domaca sarma u vinovom listu', 'gluten'],
    SNACK_AFTERNOON: ['Puding od vanile', null, 'mleko'],
  },
  {
    BREAKFAST: ['Kajgana sa tostom', 'Od domacih jaja', 'jaja, gluten'],
    SNACK_MORNING: ['Jogurt sa musli pahuljicama', null, 'mleko, gluten'],
    LUNCH: ['Paradajz corba i pasta', 'Pasta sa sirom', 'gluten, mleko'],
    SNACK_AFTERNOON: ['Voceni kolac', 'Bez secera', 'gluten, jaja'],
  },
  {
    BREAKFAST: ['Musli sa mlekom', null, 'mleko, gluten'],
    SNACK_MORNING: ['Krofnice od jabuke', null, 'gluten'],
    LUNCH: ['Boranija sa junetinom', 'Uz domaci hleb', null],
    SNACK_AFTERNOON: ['Voceni jogurt', null, 'mleko'],
  },
  {
    BREAKFAST: ['Palacinke sa dzemom', 'Domaci dzem od kajsije', 'gluten, jaja, mleko'],
    SNACK_MORNING: ['Kruska i grozdje', null, null],
    LUNCH: ['Pasulj prebranac', 'Uz kiseli krastavac', null],
    SNACK_AFTERNOON: ['Slani stapici', null, 'gluten'],
  },
  {
    BREAKFAST: ['Kifla sa maslacem', null, 'gluten, mleko'],
    SNACK_MORNING: ['Smuti od jagode', 'Sveze cedjen', 'mleko'],
    LUNCH: ['Pileci rizoto', 'Sa sargarepom i graskom', null],
    SNACK_AFTERNOON: ['Keks i mleko', null, 'gluten, mleko'],
  },
  {
    BREAKFAST: ['Sendvic sa sirom', null, 'gluten, mleko'],
    SNACK_MORNING: ['Sargarepa stapici', 'Uz humus', 'susam'],
    LUNCH: ['Musaka sa krompirom', null, 'jaja, mleko'],
    SNACK_AFTERNOON: ['Sladoled od vanile', 'Vikend poslastica', 'mleko'],
  },
  {
    BREAKFAST: ['Ovsena kasa sa medom', null, 'gluten'],
    SNACK_MORNING: ['Sezonsko voce', null, null],
    LUNCH: ['Punjene paprike', 'Uz pire krompir', 'jaja'],
    SNACK_AFTERNOON: ['Cokoladni mafin', null, 'gluten, jaja, mleko'],
  },
];

// Raspored: nedeljne aktivnosti koje se ponavljaju. dayOfWeek 0 = ponedeljak.
const ACTIVITIES = [
  { dayOfWeek: 0, title: 'Jutarnja gimnastika', startTime: '09:30', endTime: '10:15', ageGroup: '2-4 godine', color: '#7c9fc9', description: 'Zagrevanje uz muziku i poligon.' },
  { dayOfWeek: 0, title: 'Radionica crtanja', startTime: '11:00', endTime: '12:00', ageGroup: '3-6 godina', color: '#f4a261', description: 'Bojice, vodene boje i veliki papir.' },
  { dayOfWeek: 1, title: 'Muzicko igraonica', startTime: '10:00', endTime: '10:45', ageGroup: '1-3 godine', color: '#e9c46a', description: 'Pesmice, ritam i instrumenti.' },
  { dayOfWeek: 1, title: 'Engleski kroz igru', startTime: '17:00', endTime: '17:45', ageGroup: '4-6 godina', color: '#2a9d8f', description: 'Prve reci kroz price i igru.' },
  { dayOfWeek: 2, title: 'Mali kuvari', startTime: '10:30', endTime: '11:30', ageGroup: '3-6 godina', color: '#e76f51', description: 'Pravimo kolacice bez pecenja.' },
  { dayOfWeek: 2, title: 'Slobodna igra', startTime: '16:00', endTime: '18:00', ageGroup: 'svi uzrasti', color: '#a8c0d6', description: 'Tobogani, bazen sa lopticama i kocke.' },
  { dayOfWeek: 3, title: 'Plesna radionica', startTime: '10:00', endTime: '10:45', ageGroup: '3-6 godina', color: '#f4a261', description: 'Koreografije za priredbu.' },
  { dayOfWeek: 3, title: 'Cas glume', startTime: '17:30', endTime: '18:15', ageGroup: '4-6 godina', color: '#9d8189', description: 'Igrokazi i lutkarske predstave.' },
  { dayOfWeek: 4, title: 'Radionica gline', startTime: '10:30', endTime: '11:30', ageGroup: '3-6 godina', color: '#b08968', description: 'Oblikovanje i susenje figura.' },
  { dayOfWeek: 4, title: 'Bioskop u igraonici', startTime: '17:00', endTime: '18:00', ageGroup: 'svi uzrasti', color: '#457b9d', description: 'Crtani film uz kokice.' },
  { dayOfWeek: 5, title: 'Sportsko jutro', startTime: '10:00', endTime: '11:00', ageGroup: '4-6 godina', color: '#2a9d8f', description: 'Mini poligon i takmicenja.' },
  { dayOfWeek: 5, title: 'Rodjendanski termin', startTime: '16:00', endTime: '19:00', ageGroup: 'svi uzrasti', color: '#e76f51', description: 'Rezervisan termin za proslave.' },
  { dayOfWeek: 6, title: 'Porodicna nedelja', startTime: '11:00', endTime: '13:00', ageGroup: 'svi uzrasti', color: '#e9c46a', description: 'Roditelji se igraju zajedno sa decom.' },
];

async function seedMenu(monday) {
  let created = 0;
  let kept = 0;

  for (let i = 0; i < MENU.length; i++) {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    const date = toUtcDate(toKey(day));

    for (const [mealType, [name, description, allergens]] of Object.entries(MENU[i])) {
      // Rucno unet obrok se NE prepisuje - skripta samo popunjava prazna mesta.
      // Da radi upsert, ponovno pokretanje bi pobrisalo ono sto je uneto iz
      // admina. Ako bas hoces primere svuda, prvo obrisi taj dan u adminu.
      const existing = await prisma.menuItem.findFirst({ where: { date, mealType } });

      if (existing) {
        kept++;
        continue;
      }

      await prisma.menuItem.create({
        data: { date, mealType, name, description, allergens },
      });
      created++;
    }
  }

  return { created, kept };
}

async function seedSchedule() {
  let created = 0;
  let skipped = 0;

  for (const activity of ACTIVITIES) {
    // Aktivnost nema prirodni jedinstveni kljuc, pa se duplikat prepoznaje po
    // kombinaciji dana, vremena i naziva.
    const existing = await prisma.activity.findFirst({
      where: {
        dayOfWeek: activity.dayOfWeek,
        startTime: activity.startTime,
        title: activity.title,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.activity.create({
      data: { ...activity, isRecurring: true, isActive: true },
    });
    created++;
  }

  return { created, skipped };
}

async function main() {
  const monday = mondayOfThisWeek();
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  console.log(`Nedelja: ${toKey(monday)} - ${toKey(sunday)}`);

  const menu = await seedMenu(monday);
  console.log(`Jelovnik: ${menu.created} novih, ${menu.kept} vec unetih obroka zadrzano.`);

  const schedule = await seedSchedule();
  console.log(`Raspored: ${schedule.created} novih, ${schedule.skipped} vec postojecih aktivnosti.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
