# Objavljivanje na App Store i Google Play

Sve što je u kodu je urađeno. Ovde stoji ono što se popunjava u nalozima
prodavnica, plus tri stvari koje moraju da dođu od tebe.

## 1. Pravni tekstovi su popunjeni

Podaci o rukovaocu su upisani iz registra:

| Polje | Vrednost |
|---|---|
| Poslovno ime | Milica Anđelković PR Ostale zabavne i rekreativne delatnosti Kids Club Waterfront Beograd (Savski Venac) |
| Pravna forma | Preduzetnik |
| Adresa sedišta | Hercegovačka 23, 11000 Beograd (Savski Venac) |
| PIB | 113650241 |
| Matični broj | 66976815 |
| E-pošta | kidsclubbw@gmail.com |
| Telefon | 060 4721997 |

**Ime u nalozima prodavnica mora da se poklapa sa poslovnim imenom gore.** Apple
i Google porede naziv izdavača sa imenom iz politike privatnosti; neslaganje je
čest razlog za odbijanje.

Tekst se piše na jednom mestu, u `pravno/dokumenti.mjs`, pa `npm run pravno` u
`apps/admin` iz njega pravi sve kopije: javne stranice, ekran u panelu i ekran u
mobilnoj aplikaciji. Nikad se ne menja kopija — politika u aplikaciji i ona koju
vidi recenzent moraju da budu isti dokument. Provera da nije ostalo nepopunjeno
polje: `npm run pravno:proveri`.

Adrese posle objave (osnova `https://admin.207.154.218.139.sslip.io/pravno/`):

| Dokument | Srpski | English |
|---|---|---|
| Politika privatnosti | `privatnost.html` | `privacy.html` |
| Uslovi korišćenja | `uslovi.html` | `terms.html` |
| Brisanje naloga | `brisanje-naloga.html` | `account-deletion.html` |

U prodavnice se upisuju **srpske** adrese; sa svake se jednim klikom prelazi na
englesku. Isti tekst stoji i u samoj aplikaciji, na oba jezika.

## 2. Tri stvari koje moraju od tebe

1. **Expo (EAS) projekat.** Aplikacija nema `eas.json` ni `extra.eas.projectId`.
   Bez toga `getExpoPushTokenAsync` ne radi u produkcijskom buildu i obaveštenja
   ćute. Rešava se sa `npx eas init` iz tvog Expo naloga.
2. **Apple Developer nalog** (99 USD godišnje) i **Google Play Console** (25 USD
   jednokratno). Ime pravnog lica u nalogu mora da se poklapa sa imenom u
   politici privatnosti.
3. **Nalog za recenzenta.** Apple odbija svaku aplikaciju iza prijave ako nema
   nalog za testiranje. Napravi jedan pravi roditeljski nalog sa detetom i
   paketom sati, pa ga upiši u App Review Information.

## 3. Google Play — Data safety

Odgovori koji odgovaraju stvarnom stanju koda:

| Pitanje | Odgovor |
|---|---|
| Da li aplikacija prikuplja ili deli podatke? | Da, prikuplja |
| Da li se podaci šifruju u prenosu? | Da (HTTPS) |
| Da li korisnik može da zatraži brisanje podataka? | Da, iz aplikacije i sa javne adrese |
| URL za brisanje naloga | `/pravno/brisanje-naloga.html` (adresa gore) |
| Da li se podaci dele sa trećim licima? | Ne (Expo i hosting su obrađivači, ne deljenje) |
| Da li se koriste za oglašavanje ili praćenje? | Ne |

Vrste podataka koje treba označiti kao **prikupljene**, sve kao *obavezne za rad
aplikacije* i *nisu deljene*:

| Kategorija | Stavka | Svrha |
|---|---|---|
| Personal info | Name | Funkcionalnost aplikacije, upravljanje nalogom |
| Personal info | Email address | Funkcionalnost, upravljanje nalogom |
| Personal info | Phone number *(opciono)* | Funkcionalnost |
| Personal info | Other info — ime, datum rođenja i pol deteta | Funkcionalnost |
| Health and fitness | Health info — alergije deteta *(opciono)* | Funkcionalnost |
| Photos and videos | Photos *(opciono, slika profila)* | Funkcionalnost |
| App activity | Other actions — dolasci, odlasci, potrošeni sati | Funkcionalnost |
| App info and performance | Crash logs / diagnostics | Ne označavati — aplikacija ih ne šalje |

**Content rating**: ciljna grupa su odrasli (roditelji), aplikacija nije
namenjena deci. U upitniku za „Target audience and content" izaberi uzrast
**18+**, i **ne** uključuj „Designed for Families" — aplikacija sadrži podatke o
deci, ali je korisnik roditelj. Nema nasilja, kupovine, korisničkog sadržaja ni
komunikacije između korisnika.

## 4. App Store — App Privacy

Isti podaci, Appleovim rečnikom. Sve stavke: **Data Linked to You**, i za sve
**Used for Tracking: No**.

| Kategorija | Stavka |
|---|---|
| Contact Info | Name, Email Address, Phone Number |
| Health & Fitness | Health *(alergije deteta)* |
| User Content | Photos *(slika profila)*, Other User Content *(napomene o detetu)* |
| Identifiers | User ID |
| Usage Data | Product Interaction *(evidencija dolazaka)* |

Ostalo (Location, Financial Info, Contacts, Browsing History, Search History,
Sensitive Info, Diagnostics) — **ne prikuplja se**.

U `app.json` je već postavljeno:

- `ios.config.usesNonExemptEncryption: false` — aplikacija koristi samo HTTPS,
  pa izvozna deklaracija ne pita pri svakoj predaji;
- `ios.privacyManifests` sa `NSPrivacyTracking: false` i razlogom za pristup
  `UserDefaults` (`CA92.1`) — Apple to traži od maja 2024.

**Age Rating**: 4+ po sadržaju, ali u „Made for Kids" **ne** ulaziti.

## 5. App Review Information (Apple)

Popuni obavezno, inače pregled staje na prvom ekranu:

- **Sign-in required**: Yes
- **Demo account**: e-pošta i lozinka pravog roditeljskog naloga sa detetom
- **Notes**: kratko objasni da je aplikacija pratilac fizičke igraonice, da QR
  kod na ekranu „QR" skenira osoblje pri dolasku deteta, i da recenzent taj kod
  ne može da iskoristi — služi samo evidenciji u samoj igraonici.

## 6. Šta prodavnice traže a već postoji u kodu

- **Brisanje naloga iz aplikacije** — *Moj paket → Nalog → Obriši nalog*. Tvrd
  uslov obe prodavnice; bez toga aplikacija ne prolazi.
- **Politika privatnosti i uslovi u samoj aplikaciji** — kao ekran, ne kao
  adresa u pregledacu, na srpskom i engleskom. Roditelj ne ispada iz aplikacije
  i tekst se cita bez mreze.
- **Dozvole svedene na stvarne** — aplikacija traži samo obaveštenja. Kamera,
  mikrofon, lokacija i skladište su izričito blokirani u `app.json`, pa Play ne
  traži obrazloženje za dozvole kojih nema.
- **Nema praćenja ni reklama** — nema ATT upita, nema reklamnih SDK-ova.

## 7. Materijal za listing

Treba pripremiti (nije kod):

- ikonica 1024×1024 bez providnosti i bez zaobljenih uglova (Apple je sam
  zaobljava);
- snimci ekrana: iPhone 6.7" i 6.5", Android telefon — najmanje 2, obično 4-6;
- kratak opis (80 znakova) i pun opis;
- kategorija: **Lifestyle** ili **Education**;
- adresa podrške — može ista adresa e-pošte iz politike.
