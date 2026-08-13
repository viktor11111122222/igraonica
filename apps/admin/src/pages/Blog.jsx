import { useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post, uploadImage } from '../lib/api';
import { formatDate } from '../lib/format';

const EMPTY = {
  title: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  isPublished: false,
  isFeatured: false,
};

export default function Blog() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(`/blog/all?page=${page}&limit=20`);
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const fileRef = useRef(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      title: form.title,
      content: form.content,
      excerpt: form.excerpt || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      isPublished: form.isPublished,
      isFeatured: form.isFeatured,
    };
    try {
      if (form.id) await patch(`/blog/${form.id}`, payload);
      else await post('/blog', payload);
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
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (e) {
      setFormError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function togglePublished(p) {
    try {
      await patch(`/blog/${p.id}`, { isPublished: !p.isPublished });
      reload();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/blog/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Blog" subtitle="Objave koje roditelji vide u aplikaciji">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Nova objava
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || formError}</Alert>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.posts?.length ? (
            <Empty title="Nema objava" text="Napisite prvu objavu za roditelje.">
              <button className="btn" onClick={() => setForm({ ...EMPTY })}>
                Nova objava
              </button>
            </Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Naslov</th>
                      <th>Autor</th>
                      <th>Objavljen</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.posts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="inline">
                            {p.coverImageUrl && (
                              <img
                                src={p.coverImageUrl}
                                alt=""
                                style={{
                                  width: 52,
                                  height: 40,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  flex: '0 0 52px',
                                }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div className="row-main">{p.title}</div>
                              <div className="row-sub mono">/{p.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted">
                          {p.author.firstName} {p.author.lastName}
                        </td>
                        <td className="muted">
                          {p.publishedAt ? formatDate(p.publishedAt) : '—'}
                        </td>
                        <td>
                          <div className="inline">
                            <Badge tone={p.isPublished ? 'green' : 'gray'}>
                              {p.isPublished ? 'Objavljen' : 'Nacrt'}
                            </Badge>
                            {p.isFeatured && <Badge tone="amber">Istaknut</Badge>}
                          </div>
                        </td>
                        <td className="actions">
                          <button className="btn secondary sm" onClick={() => togglePublished(p)}>
                            {p.isPublished ? 'Skloni' : 'Objavi'}
                          </button>{' '}
                          <button
                            className="btn ghost sm"
                            onClick={() =>
                              setForm({
                                id: p.id,
                                title: p.title,
                                excerpt: p.excerpt || '',
                                content: p.content,
                                coverImageUrl: p.coverImageUrl || '',
                                isPublished: p.isPublished,
                                isFeatured: p.isFeatured,
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
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...data.pagination} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {form && (
        <Modal
          title={form.id ? 'Izmena objave' : 'Nova objava'}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" onClick={save} disabled={busy || uploading}>
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form onSubmit={save}>
            <Alert>{formError}</Alert>
            <Field label="Naslov" hint={form.id ? 'Promena naslova menja i adresu objave.' : undefined}>
              <input value={form.title} onChange={set('title')} required />
            </Field>
            <Field label="Kratak opis" hint="Prikazuje se u listi objava.">
              <input value={form.excerpt} onChange={set('excerpt')} />
            </Field>

            <Field label="Naslovna slika">
              {form.coverImageUrl ? (
                <div className="inline">
                  <img
                    src={form.coverImageUrl}
                    alt=""
                    style={{ width: 120, height: 76, objectFit: 'cover', borderRadius: 10 }}
                  />
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForm((f) => ({ ...f, coverImageUrl: '' }))}
                  >
                    Ukloni
                  </button>
                </div>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} />
                  {uploading && <div className="field-hint">Slika se salje...</div>}
                </>
              )}
            </Field>

            <Field label="Sadrzaj">
              <textarea
                value={form.content}
                onChange={set('content')}
                required
                style={{ minHeight: 200 }}
              />
            </Field>

            <label className="check">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              Objavljeno (vidljivo roditeljima)
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
              />
              Istaknuto na pocetnoj
            </label>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Obrisati objavu?"
          text={`"${deleting.title}" ce biti trajno obrisana.`}
          confirmLabel="Obrisi"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
