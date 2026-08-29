import { useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post, uploadImage } from '../lib/api';

const EMPTY = {
  title: '',
  description: '',
  imageUrl: '',
  showPopup: true,
  isActive: true,
};

// Promocija nema rok: stoji dok je osoblje ne iskljuci ili obrise, i ukljucuje
// se ponovo kad god zatreba.
function stanje(p) {
  return p.isActive
    ? { label: 'U aplikaciji', tone: 'green' }
    : { label: 'Iskljucena', tone: 'gray' };
}

export default function PromoBanners() {
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  // Greska pri brisanju ide u sam dijalog - traka na stranici je iza njega.
  const [brisanjeGreska, setBrisanjeGreska] = useState('');
  const fileRef = useRef(null);

  const { data, loading, error, reload } = useFetch('/promo-banners/all');
  const promocije = data?.promoBanners || [];

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      title: form.title,
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      showPopup: form.showPopup,
      isActive: form.isActive,
    };
    try {
      if (form.id) await patch(`/promo-banners/${form.id}`, payload);
      else await post('/promo-banners', payload);
      setForm(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError('');
    try {
      const { url } = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      setFormError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggle(p) {
    try {
      await patch(`/promo-banners/${p.id}`, { isActive: !p.isActive });
      reload();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/promo-banners/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setBrisanjeGreska(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Promocije" subtitle="Baneri koje roditelji vide u aplikaciji">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Nova promocija
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || formError}</Alert>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !promocije.length ? (
            <Empty
              title="Nema promocija"
              text="Promocija se u aplikaciji prvi put pokaze preko celog ekrana, a posle stoji na pocetnoj."
            >
              <button className="btn" onClick={() => setForm({ ...EMPTY })}>
                Nova promocija
              </button>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Promocija</th>
                    <th>Prvi ulazak</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {promocije.map((p) => {
                    const s = stanje(p);
                    return (
                      <tr key={p.id}>
                        <td data-label="Promocija">
                          <div className="inline">
                            {p.imageUrl && (
                              <img
                                src={p.imageUrl}
                                alt=""
                                style={{
                                  width: 64,
                                  height: 44,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  flex: '0 0 64px',
                                }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div className="row-main">{p.title}</div>
                              {p.description && <div className="row-sub">{p.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td data-label="Prvi ulazak">
                          <Badge tone={p.showPopup ? 'blue' : 'gray'}>
                            {p.showPopup ? 'Iskace' : 'Ne iskace'}
                          </Badge>
                        </td>
                        <td data-label="Status">
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </td>
                        <td className="actions">
                          <button className="btn secondary sm" onClick={() => toggle(p)}>
                            {p.isActive ? 'Iskljuci' : 'Ukljuci'}
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={() =>
                              setForm({
                                id: p.id,
                                title: p.title,
                                description: p.description || '',
                                imageUrl: p.imageUrl || '',
                                showPopup: p.showPopup,
                                isActive: p.isActive,
                              })
                            }
                          >
                            Izmeni
                          </button>
                          <button className="btn ghost sm" onClick={() => setDeleting(p)}>
                            Obrisi
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {form && (
        <Modal
          title={form.id ? 'Izmena promocije' : 'Nova promocija'}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button
                className="btn"
                disabled={busy || uploading}
                type="submit"
                form="promocija-forma"
              >
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="promocija-forma" onSubmit={save}>
            <Alert>{formError}</Alert>

            {/* Polje za sliku je jedino dete `Field`-a: tako natpis dobija `for` i
                dodir na "Slika banera" otvara birac fajlova. Napomena ide kroz
                `hint`, ne kao drugo dete. */}
            <Field
              label="Slika banera"
              hint={
                uploading
                  ? 'Slika se salje...'
                  : 'Nije obavezna - bez nje ostaje samo naslov i tekst.'
              }
            >
              {form.imageUrl ? (
                <div className="inline">
                  <img
                    src={form.imageUrl}
                    alt=""
                    style={{ width: 160, height: 96, objectFit: 'cover', borderRadius: 10 }}
                  />
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  >
                    Ukloni
                  </button>
                </div>
              ) : (
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} />
              )}
            </Field>

            <Field label="Naslov">
              <input value={form.title} onChange={set('title')} required />
            </Field>

            <Field label="Sta je promocija" hint="Tekst koji roditelj cita ispod naslova.">
              <textarea value={form.description} onChange={set('description')} rows={3} />
            </Field>

            <label className="check">
              <input
                type="checkbox"
                checked={form.showPopup}
                onChange={(e) => setForm((f) => ({ ...f, showPopup: e.target.checked }))}
              />
              Pokazi preko celog ekrana pri prvom ulasku u aplikaciju
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Aktivna (vidi se u aplikaciji dok je ne iskljucite)
            </label>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Obrisati promociju?"
          text={`"${deleting.title}" nestaje iz aplikacije. Ako zelite da je samo sklonite, iskljucite je.`}
          confirmLabel="Obrisi"
          busy={busy}
          onConfirm={remove}
          error={brisanjeGreska}
          onClose={() => {
            setDeleting(null);
            setBrisanjeGreska('');
          }}
        />
      )}
    </>
  );
}
