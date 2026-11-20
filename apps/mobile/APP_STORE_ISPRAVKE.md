# App Store — ispravke za prolaz review-a (KidsClubApp, 1.0.2)

Pregled App Store Connect-a 20. okt 2026. Aplikacija ostaje ista
(Apple ID 6817846145, bundle ID `kidsclub.rs`) — nova aplikacija u Connect-u
**ne treba** i bila bi rizik (4.3 duplikat).

Trenutna prijava (1.0.2, build 1.0.1 (1)) čeka review. Koraci 1–3 se rade
**bez povlačenja prijave**.

**Stanje 20. okt 2026:** urađeno u Connect-u i provereno posle osvežavanja
stranice — App Privacy (7 stavki, objavljeno), Notes (ceo tekst ispod),
Marketing URL obrisan. Prijava i dalje „Waiting for Review“.
Ostaje: Support URL (posle objave `podrska.html`), tačka 4 i, po želji,
kategorija Lifestyle umesto Education (guideline 2.3.5).

## 0. Verzija 1.1.2 — greške nađene testiranjem (20. okt 2026)

Ceo tok kao recenzent, na iPhone 17 Pro i iPad Pro 11 simulatoru, protiv
lokalnog servera: registracija, dodavanje deteta, QR, jelovnik, raspored,
brisanje naloga. Nađene i ispravljene dve greške — obe postoje u kodu od
avgusta/septembra, pa skoro sigurno i u buildu 1.0.1 koji čeka review:

1. **Dodavanje deteta bez izabranog pola puca** („Greska na serveru“).
   Aplikacija je slala `gender: null`, server to odbija kao nevazeci pol.
   - aplikacija: `AddChildScreen.js` salje pol samo ako je izabran;
     `api.js` prikazuje poruku validacije umesto „Greska na serveru“;
   - server: `routes/children.js` prihvata `null` (`optional({ values: 'null' })`).
   **Ako se server objavi odmah, ova greska nestaje i za build 1.0.1 koji
   sada ceka** — vredi uraditi pre nego sto ga recenzent otvori.
2. **Dijalog „Brisanje naloga“: dugmad bez natpisa**, skupljena u dva prazna
   ovala. `PressableScale` daje stil unutrasnjem View-u, pa je `flex: 1`
   skupio visinu na nulu. Ispravljeno omotacem (kao `genderCell`), plus
   `KeyboardAvoidingView` da tastatura ne prekrije dugme na telefonu.
   Ovo se ispravlja samo novim buildom.

Testovi: mobilni 483, backend 599, lint cist. Release build za simulator
prolazi i pokrece se bez Metro-a (`kidsclub.rs`, 1.1.2, build 1).
Napomena: jelovnik na produkciji mora da ima unete obroke za nedelju
review-a — prazan ekran „Za ovaj dan nema jelovnika“ recenzent moze da
oceni kao nedovrsenu aplikaciju (2.1).

## 1. App Privacy — najvažnije ✅

Sada piše „Data Not Collected“, a aplikacija i politika privatnosti kažu da se
podaci prikupljaju. Apple to poredi i odbija (5.1.1 / 5.1.2).

App Privacy → Data Types → **Edit** → „Yes, we collect data from this app“, pa
označi samo ovo:

| Kategorija | Stavka | Šta je to u aplikaciji |
|---|---|---|
| Contact Info | Name | ime i prezime roditelja i deteta |
| Contact Info | Email Address | prijava |
| Health & Fitness | Health | alergije deteta (neobavezno) |
| User Content | Other User Content | napomene o detetu |
| Identifiers | User ID | ID naloga |
| Usage Data | Product Interaction | evidencija dolazaka i odlazaka |
| Other Data | Other Data Types | datum rođenja i pol deteta |

Za **svaku** stavku:
- Purpose: **App Functionality** (samo to)
- Linked to the user: **Yes**
- Used for tracking: **No**

Ne označavati: Phone Number, Photos, Location, Financial Info, Contacts,
Diagnostics, Device ID — aplikacija ih ne prikuplja. Na kraju **Publish**.

## 2. App Review Information → Notes ✅

Apple je 2. okt tražio da odgovori stoje i u Notes polju. Zameni ceo sadržaj
Notes polja tekstom ispod (oko 2.400 karaktera, limit je 4.000). Demo nalog
ostaje u poljima Sign-In Information.

```
PURPOSE AND TARGET AUDIENCE
Kids Club is a companion app for parents whose children attend the Kids Club indoor playroom in Belgrade, Serbia. Parents see their remaining prepaid hours, show their child's QR code at reception for check-in and check-out, and view the daily meal plan (with allergens) and the weekly activity schedule. The app is for parents (adults); it is not designed for or used by children. The app is in Serbian because all users are Serbian-speaking parents.

HOW TO REVIEW
Sign in with the demo account in Sign-In Information. It has one child and an active 20-hour package, so every screen shows real data. There is only one account type (parent).
- "Moj paket" tab: remaining hours, package validity, children
- Round "QR" button in the bottom bar: choose a child to show the check-in QR code. The code is scanned by playroom staff at reception; it cannot be used outside the playroom.
- "Jelovnik" tab: daily meal plan with allergens
- "Raspored" tab: weekly activity schedule
- Sign up: "Registrujte se" on the login screen
- Account deletion: "Moj paket" tab > "Nalog" section > "Obrisi nalog" > enter password > account and all child data are deleted immediately.

SCREEN RECORDING
Attached (kidsclub-testflight.mp4), recorded on a physical iPhone: launch, sign up, login, adding a child, QR code, meal plan, schedule and account deletion.

EXTERNAL SERVICES
- Our own backend API (https://api.kids-club.rs, Node.js + PostgreSQL) on a DigitalOcean server in Frankfurt, EU. All data and email/password authentication.
- Expo Push Notification Service for check-in/check-out notifications.
No advertising, analytics, tracking SDKs, payment processors, AI services or third-party sign-in. The app does not use the advertising identifier. There are no in-app purchases; packages are paid at the playroom.

REGIONAL DIFFERENCES
None. The app works the same in every region.

REGULATED INDUSTRY / THIRD-PARTY CONTENT
Not a regulated industry. No third-party protected content; all content belongs to the playroom.

CHILDREN'S DATA
The parent enters the child's name, date of birth and optional allergy notes so staff know about dietary restrictions. This data is visible only to that parent and playroom staff, never shared with third parties, and deleted when the parent deletes the account. Privacy policy: https://admin.kids-club.rs/pravno/privatnost.html
```

## 3. Support URL i Marketing URL

- **Support URL** sada vodi na Uslove korišćenja. Treba da vodi na stranicu sa
  kontaktom: `https://admin.kids-club.rs/pravno/podrska.html`.
  Ta stranica je napravljena (`npm run pravno` u `apps/admin`), ali **mora prvo
  da se objavi na server** — zajedno sa ostatkom `apps/admin` (build pa
  postavljanje `dist/` kao i do sada). Tek kada adresa radi u pregledaču, upiši
  je u Connect.
- **Marketing URL** sada vodi na politiku privatnosti — obriši ga (polje nije
  obavezno).

Ako Connect ne dozvoli izmenu URL-ova dok prijava čeka, upiši ih uz sledeći
build.

## 4. Samo Account Holder (Milica)

1. **License Agreement** — na početnoj strani Connect-a stoji žuto upozorenje.
   Prijaviti se na developer.apple.com/account i prihvatiti novi ugovor. Dok
   nije prihvaćen, Apple može da blokira prijave.
2. **Digital Services Act (trader status)** — App Information → Digital
   Services Act → Set Up. Bez toga Apple uklanja aplikaciju iz EU. Druga
   opcija: Pricing and Availability → isključiti zemlje EU.

## 5. Sledeći build (već sređeno u kodu)

- `app.json`: bundle ID `kidsclub.rs` (isti kao u Connect-u; ranije je
  lokalno stajalo `com.vica.kidsclub` i takav build Connect ne bi primio),
  verzija `1.0.2`, build broj `2`.
- `src/utils/api.js`: produkcijski build ide na `https://api.kids-club.rs/api`.
  Ranije je bez `EXPO_PUBLIC_API_URL` išao na `localhost` i stajao na prvom
  ekranu.
- Pre builda: `npx expo prebuild --platform ios --clean` (folder `ios/` je
  generisan i nije u git-u), pa Archive u Xcode-u.
- Push obaveštenja u produkcijskom buildu traže EAS projekat
  (`npx eas init`, vidi PRODAVNICE.md). Nije uslov za review.
- `supportsTablet: true` — Apple može da testira na iPad-u. Pre slanja
  proveriti sve ekrane na iPad simulatoru.
