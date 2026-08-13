import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, SettingRow, Spinner, Stepper, Switch } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { useTheme, THEMES } from '../context/ThemeContext';
import { patch } from '../lib/api';

// Ekrani na kojima obavestenje moze da se pojavi. Imena moraju da se poklapaju
// sa onim sto mobilna aplikacija salje komponenti Announcement.
const ANNOUNCE_TABS = [
  { key: 'home', label: 'Pocetna' },
  { key: 'menu', label: 'Jelovnik' },
  { key: 'schedule', label: 'Raspored' },
  { key: 'package', label: 'Moj paket' },
];

// Van komponente: da se pri svakom renderu ne montira novo polje, cime bi
// fokus iskakao usred kucanja. Tekst se cuva kada polje izgubi fokus.
function TextSetting({ label, hint, placeholder, multiline, value, status, onSave }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <SettingRow label={label} hint={hint} status={status}>
      <Tag
        className="setting-input"
        placeholder={placeholder}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          if (e.target.value !== value) onSave(e.target.value);
        }}
      />
    </SettingRow>
  );
}

export default function Settings() {
  const { data, loading, error, reload } = useFetch('/settings');
  const { theme, setTheme } = useTheme();

  const [values, setValues] = useState({});
  const [status, setStatus] = useState({});
  const [saveError, setSaveError] = useState('');
  const timers = useRef({});

  const settings = data?.settings || [];
  const original = useMemo(
    () => Object.fromEntries(settings.map((s) => [s.key, s.value])),
    [settings]
  );

  useEffect(() => setValues(original), [original]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  // Svaka kontrola cuva samu sebe. Nema odvojenog dugmeta "Sacuvaj" koje se
  // lako previdi, pa se izmena ne moze izgubiti time sto se zaboravi klik.
  async function save(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus((s) => ({ ...s, [key]: 'saving' }));
    setSaveError('');

    clearTimeout(timers.current[key]);
    // Kratko cekanje da uzastopni klikovi na +/- ne salju zahtev po kliku.
    timers.current[key] = setTimeout(async () => {
      try {
        await patch(`/settings/${key}`, { value });
        setStatus((s) => ({ ...s, [key]: 'saved' }));
        timers.current[`${key}-clear`] = setTimeout(
          () => setStatus((s) => ({ ...s, [key]: null })),
          2000
        );
      } catch (e) {
        setSaveError(e.message);
        setStatus((s) => ({ ...s, [key]: null }));
        reload();
      }
    }, 400);
  }

  const val = (key) => values[key] ?? '';
  const on = (key) => val(key) === 'true';

  // Lista ekrana se cuva kao tekst razdvojen zarezom.
  const announceTabs = val('announcement_tabs')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleAnnounceTab(key) {
    const next = announceTabs.includes(key)
      ? announceTabs.filter((t) => t !== key)
      : [...announceTabs, key];
    save('announcement_tabs', next.join(','));
  }

  // `key` je originalna vrednost sa servera: polje se resetuje samo kada
  // podatak stvarno stigne izvana, a ne posle svakog naseg cuvanja.
  const textProps = (key, extra) => ({
    value: val(key),
    status: status[key],
    onSave: (v) => save(key, v),
    ...extra,
  });

  if (loading) return <Spinner />;

  const announcementText = val('mobile_announcement').trim();

  return (
    <>
      <PageHeader
        title="Podesavanja"
        subtitle="Sve se cuva samo - nema dugmeta za potvrdu"
      />

      <div className="page stack">
        <Alert>{error || saveError}</Alert>

        <div className="card">
          <div className="card-head">
            <h2>Izgled panela</h2>
            <div className="spacer" />
            <Badge tone="gray">samo ovaj uredjaj</Badge>
          </div>
          <div className="card-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <SettingRow label="Tema" hint="Pamti se u ovom pregledacu.">
              <div className="chips">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`chip ${theme === t.key ? 'on' : ''}`}
                    onClick={() => setTheme(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Obavestenje roditeljima</h2>
          </div>
          <div className="card-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <TextSetting
              {...textProps('mobile_announcement', {
                label: 'Tekst',
                hint: 'Ostavite prazno da se obavestenje nigde ne prikazuje.',
                placeholder: 'npr. U subotu radimo do 23h',
                multiline: true,
              })}
            />
            <SettingRow
              label="Gde se prikazuje"
              hint={
                announcementText
                  ? 'Ukljucite ekrane na kojima roditelj vidi ovu poruku.'
                  : 'Prvo unesite tekst iznad - bez teksta se ne prikazuje nigde.'
              }
              status={status.announcement_tabs}
            >
              <div className="chips">
                {ANNOUNCE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`chip ${announceTabs.includes(t.key) ? 'on' : ''}`}
                    onClick={() => toggleAnnounceTab(t.key)}
                    disabled={!announcementText}
                    style={!announcementText ? { opacity: 0.5 } : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Sta roditelji vide u aplikaciji</h2>
          </div>
          <div className="card-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <SettingRow
              label="Jelovnik"
              hint="Tab sa obrocima po danima."
              status={status.mobile_tab_menu}
            >
              <Switch
                checked={on('mobile_tab_menu')}
                onChange={(v) => save('mobile_tab_menu', String(v))}
              />
            </SettingRow>
            <SettingRow
              label="Raspored"
              hint="Tab sa nedeljnim aktivnostima."
              status={status.mobile_tab_schedule}
            >
              <Switch
                checked={on('mobile_tab_schedule')}
                onChange={(v) => save('mobile_tab_schedule', String(v))}
              />
            </SettingRow>
            <SettingRow
              label="Galerija"
              hint="Traka sa fotografijama na pocetnom ekranu."
              status={status.mobile_tab_gallery}
            >
              <Switch
                checked={on('mobile_tab_gallery')}
                onChange={(v) => save('mobile_tab_gallery', String(v))}
              />
            </SettingRow>
            <SettingRow
              label="Pocetna, Moj paket i QR kod"
              hint="Ne mogu da se iskljuce - to je sustina aplikacije."
            >
              <Switch checked disabled onChange={() => {}} />
            </SettingRow>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Naplata vremena</h2>
          </div>
          <div className="card-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <SettingRow
              label="Zaokruzivanje"
              hint={`Boravak se zaokruzuje navise na ovaj korak. Za ${
                val('rounding_minutes') || 15
              } min: boravak od 40 min naplacuje se kao ${
                Math.ceil(40 / (Number(val('rounding_minutes')) || 15)) *
                (Number(val('rounding_minutes')) || 15)
              } min.`}
              status={status.rounding_minutes}
            >
              <Stepper
                value={val('rounding_minutes')}
                onChange={(v) => save('rounding_minutes', v)}
                step={5}
                min={1}
                max={60}
                unit="min"
                presets={[5, 10, 15, 30]}
              />
            </SettingRow>
            <SettingRow
              label="Najmanja naplata"
              hint="I kratak boravak se naplacuje kao ovoliko minuta."
              status={status.minimum_charge_minutes}
            >
              <Stepper
                value={val('minimum_charge_minutes')}
                onChange={(v) => save('minimum_charge_minutes', v)}
                step={15}
                min={0}
                max={180}
                unit="min"
                presets={[15, 30, 45, 60]}
              />
            </SettingRow>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Podaci o igraonici</h2>
            <div className="spacer" />
            <Badge tone="gray">vide roditelji</Badge>
          </div>
          <div className="card-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <TextSetting {...textProps('club_name', { label: 'Naziv', placeholder: 'Kids club' })} />
            <TextSetting
              {...textProps('club_phone', { label: 'Telefon', placeholder: '021 123 456' })}
            />
            <TextSetting
              {...textProps('club_email', {
                label: 'Email',
                placeholder: 'kontakt@igraonica.rs',
              })}
            />
            <TextSetting
              {...textProps('club_address', {
                label: 'Adresa',
                placeholder: 'Ulica i broj, grad',
              })}
            />
            <TextSetting
              {...textProps('working_hours', {
                label: 'Radno vreme',
                placeholder: '09:00 - 21:00',
              })}
            />
            <TextSetting
              {...textProps('club_latitude', {
                label: 'Geografska sirina',
                placeholder: '45.267136',
                hint: 'Za dugme "Prikazi na mapi" u aplikaciji. Uzmi iz Google Maps: desni klik na lokaciju pa klik na koordinate.',
              })}
            />
            <TextSetting
              {...textProps('club_longitude', {
                label: 'Geografska duzina',
                placeholder: '19.833549',
                hint: 'Ako je bilo koja koordinata prazna, dugme se ne prikazuje.',
              })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
