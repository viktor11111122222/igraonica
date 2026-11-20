# Kids Club 1.1.2 — koraci do prijave

Zašto nova verzija: u buildu 1.0.1 koji sada čeka review postoje dve greške
koje bi reviewer verovatno video:

1. dodavanje deteta bez izabranog pola puca („Greska na serveru“);
2. u dijalogu za brisanje naloga dugmad „Odustani“ i „Obriši“ nemaju natpis.

Obe su ispravljene u 1.1.2 i proverene na simulatoru (iPhone i iPad), zajedno
sa registracijom, QR kodom, jelovnikom, rasporedom i brisanjem naloga.

**Trenutnu prijavu ne povlačiti dok build 1.1.2 nije otpremljen i obrađen** —
inače aplikacija ostaje bez ičega u redu.

Ko radi šta: **M** = Milica (Account Holder), **V** = Viktor, **S** = ko ima
pristup serveru, **C** = Claude na Viktorovom Mac-u.

---

## Faza 1 — Milica (oko 15 minuta, svojim Apple nalogom)

### 1. Prihvati novi ugovor (M)
1. Otvori developer.apple.com/account i prijavi se svojim Apple ID-jem.
2. Na vrhu stoji obaveštenje o novom Apple Developer Program License
   Agreement → **Review Agreement**.
3. Pročitaj, štikliraj i klikni **Agree**.
4. Otvori appstoreconnect.apple.com → **Business** i proveri da nigde ne piše
   „Action Needed“ za ugovore.

Bez ovoga Apple može da odbije otpremanje builda ili prijavu.

### 2. DSA trader status (M)
App Store Connect → Apps → KidsClubApp → **App Information** → Digital
Services Act → **Set Up**.
- Aplikacija služi delatnosti igraonice, pa je odgovor: **trader**.
- Unose se poslovni podaci: Hercegovačka 23, 11000 Beograd, kidsclubbw@gmail.com,
  060 4721997. Apple šalje kod za potvrdu na email i telefon.
- Ovi podaci se javno prikazuju na App Store-u u EU.

Ako ne želi da ih objavi: Pricing and Availability → isključiti zemlje EU.
Bez jednog od ova dva Apple uklanja aplikaciju iz EU.

### 3. Omogući potpisivanje builda (M) — izabrati A ili B

Viktor je Admin, ali je Milicin nalog *Individual*, pa Admin ne dobija
sertifikate za potpisivanje. Zato mora jedno od ovoga:

**A — za danas, najbrže.** Milica na Viktorovom Mac-u:
1. Otvori **Xcode** → meni Xcode → **Settings…** → kartica **Accounts**.
2. Dole levo **+** → **Apple Account** → Continue.
3. Unese svoj Apple ID i lozinku i kod za dvostepenu potvrdu (sama, ne
   diktira nikome).
4. U listi timova treba da se vidi **Milica Andjelkovic**.
5. Ostane ulogovana dok build ne bude otpremljen (oko sat vremena). Posle
   može da ukloni nalog dugmetom **−**.

**B — trajno, da ubuduće ne mora da bude prisutna.**
1. App Store Connect → **Users and Access** → **Integrations** →
   **App Store Connect API** → **Request Access** → prihvati uslove.
2. Kad Apple odobri (obično odmah), **Viktor** na istoj stranici: **Generate
   API Key** → ime „Kids Club build“ → Access: **Admin** → Generate.
3. Viktor klikne **Download API Key** (može samo jednom!) i sačuva `.p8`
   fajl u `~/private_keys/` na Mac-u. Key ID i Issuer ID stoje na istoj
   stranici. Ključ se nikome ne šalje i ne lepi u chat — Claude-u se kaže
   samo gde je fajl.

Preporuka: A danas, B kad stigne, za sledeća ažuriranja.

---

## Faza 2 — server i podaci (može paralelno sa Fazom 1)

### 4. Objavi backend i admin panel (S)
Pre toga C commit-uje izmene (na Viktorov zahtev).
- **Backend** (`apps/backend`): ispravka da server prihvata dete bez pola.
  Nije obavezna za 1.1.2, ali je dobra i za stare instalacije.
- **Admin** (`apps/admin` → `npm run build` → objaviti `dist/` kao i do
  sada): nova stranica za podršku.
- Provera: https://admin.kids-club.rs/pravno/podrska.html se otvara.

### 5. Proveri demo nalog i podatke (M ili V)
Na telefonu, u postojećoj aplikaciji:
- prijava sa demo nalogom iz App Review Information radi;
- vidi se dete i paket od 20 sati;
- u admin panelu **Jelovnik** i **Raspored** su popunjeni za naredne
  **dve nedelje** (review može da potraje, a prazan ekran deluje nedovršeno).

---

## Faza 3 — build 1.1.2 (C, uz Viktora)

### 6. Build i otpremanje (C)
Claude podesi tim, napravi Release Archive (bundle `kidsclub.rs`, verzija
1.1.2, build 1) i otpremi ga u App Store Connect.
Viktor: ako macOS pita „codesign wants to access key…“, upiše svoju Mac
lozinku i klikne **Always Allow**.

### 7. Sačekaj obradu (V)
5–30 minuta. Stiže email da je build obrađen; u **TestFlight** se vidi
1.1.2 (1). Pitanje o enkripciji se ne pojavljuje (već podešeno u kodu).

### 8. Test na pravom telefonu i nov snimak (V ili M) — preporučeno
1. TestFlight → Internal Testing → dodaj sebe kao testera.
2. Na iPhone-u instaliraj aplikaciju **TestFlight** i otvori pozivnicu.
3. Prođi: registracija novog naloga → dodaj dete **bez** izabranog pola →
   QR → Jelovnik → Raspored → Moj paket → Nalog → Obriši nalog (dugmad
   moraju da imaju natpis).
4. Sve to snimi snimanjem ekrana (Control Center → Screen Recording),
   od pokretanja aplikacije. Stari snimak je sa 1.0.1, gde dugmad za brisanje
   nemaju natpis.

---

## Faza 4 — nova prijava (V ili C, Admin može)

Tek kada je build 1.1.2 obrađen (korak 7):

### 9. Povuci staru prijavu
App Store Connect → KidsClubApp → **1.0.2 Waiting for Review** → na vrhu
„remove this version from review“ → potvrdi.

### 10. Promeni verziju i build
Na istoj stranici:
1. Polje **Version**: `1.0.2` → `1.1.2`.
2. Sekcija **Build**: ukloni 1.0.1 (1) → **Add Build** → izaberi
   **1.1.2 (1)** → Done.
3. **Support URL**: `https://admin.kids-club.rs/pravno/podrska.html`
   (samo ako se stranica iz koraka 4 otvara).
4. **App Review Information → Attachment**: zameni snimak novim iz koraka 8.
5. Notes i Sign-In Information su već sređeni — ne dirati.
6. **Save**.

### 11. Pošalji
**Add for Review** → **Submit for Review**. Status: *Waiting for Review*.

---

## Faza 5 — čekanje

- Obično 24–48 sati. Apple šalje email na svaku promenu statusa.
- Ako Apple postavi pitanje ili odbije: **ne slati ponovo naslepo** —
  otvoriti poruku u App Review i javiti Claude-u.

## Već urađeno u App Store Connect-u (20. okt 2026)
- App Privacy: 7 tipova podataka, sve za App Functionality, bez praćenja.
- Notes za reviewer-a: kompletni odgovori na Apple-ovo pitanje od 2. okt.
- Marketing URL obrisan.
