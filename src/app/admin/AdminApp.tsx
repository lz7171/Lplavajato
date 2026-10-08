'use client';

import { useCallback, useEffect, useState } from 'react';
import { CATEGORY_LABEL, GALLERY_CATEGORIES, type GalleryCategory } from '@/lib/gallery';
import type { Settings } from '@/lib/store';

type StaticWork = { category: GalleryCategory; alt: string };
type Tab = 'fotos' | 'servicos' | 'horarios' | 'contato';
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

/** Reduz a foto para no máx. 1600 px (JPEG) antes de enviar: upload rápido e site leve. */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Não consegui ler a imagem.');
  return { blob, width, height };
}

export function AdminApp() {
  const [state, setState] = useState<'loading' | 'login' | 'ready'>('loading');
  const [s, setS] = useState<Settings | null>(null);
  const [statics, setStatics] = useState<StaticWork[]>([]);
  const [db, setDb] = useState(true);
  const [dbError, setDbError] = useState('');
  const [tab, setTab] = useState<Tab>('fotos');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [uploadCat, setUploadCat] = useState<GalleryCategory>('corte');

  const apply = useCallback(({ status, data }: { status: number; data: Record<string, unknown> }) => {
    if (status === 401) return setState('login');
    setS(data.settings as Settings);
    setStatics(data.staticWorks as StaticWork[]);
    setDb(data.db === true);
    const de = data.dbError as { code: string; hint: string } | undefined;
    setDbError(de ? `${de.hint} (${de.code})` : '');
    setState('ready');
  }, []);
  const load = useCallback(() => api('/api/admin/settings').then(apply), [apply]);
  useEffect(() => {
    let live = true;
    void api('/api/admin/settings').then((r) => live && apply(r));
    return () => {
      live = false;
    };
  }, [apply]);

  const login = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    const { status, data } = await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (status === 200) {
      setPassword('');
      setMsg(null);
      void load();
    } else setMsg({ kind: 'err', text: String(data.error ?? 'Erro ao entrar.') });
  };

  const save = async () => {
    if (!s) return;
    setBusy(true);
    const { status, data } = await api('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setBusy(false);
    if (status === 200) {
      setS(data.settings as Settings);
      setMsg({ kind: 'ok', text: 'Salvo! O site já foi atualizado.' });
    } else setMsg({ kind: 'err', text: String(data.error ?? 'Não foi possível salvar.') });
  };

  const upload = async (files: FileList | null) => {
    if (!files || !s) return;
    setBusy(true);
    let done = 0;
    for (const file of Array.from(files)) {
      try {
        setMsg({ kind: 'ok', text: `Enviando ${done + 1} de ${files.length}…` });
        const small = await shrink(file);
        const form = new FormData();
        form.append('file', new File([small.blob], 'foto.jpg', { type: 'image/jpeg' }));
        form.append('category', uploadCat);
        form.append('alt', `${CATEGORY_LABEL[uploadCat]} – trabalho do Jef Barber`);
        form.append('width', String(small.width));
        form.append('height', String(small.height));
        const { status, data } = await api('/api/admin/upload', { method: 'POST', body: form });
        if (status !== 200) throw new Error(String(data.error ?? 'Falha no envio.'));
        const photo = data.photo as Settings['photos'][number];
        setS((cur) => (cur ? { ...cur, photos: [photo, ...cur.photos] } : cur));
        done++;
      } catch (err) {
        setMsg({ kind: 'err', text: `${file.name}: ${err instanceof Error ? err.message : 'erro'}` });
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setMsg({ kind: 'ok', text: `${done} foto(s) publicada(s) no site.` });
  };

  if (state === 'loading') return <main className="adm"><p>Carregando…</p></main>;

  if (state === 'login')
    return (
      <main className="adm">
        <form className="login card" onSubmit={login}>
          <h1>Painel Jef Barber</h1>
          <label htmlFor="pw">Senha</label>
          <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {msg && <p className="note err">{msg.text}</p>}
          <p><button className="btn" disabled={busy || !password}>Entrar</button></p>
        </form>
      </main>
    );

  if (!s) return null;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const biz = (patch: Partial<Settings['business']>) => set({ business: { ...s.business, ...patch } });

  return (
    <main className="adm">
      <div className="top">
        <div>
          <h1>Painel Jef Barber</h1>
          <a href="/" target="_blank">Ver o site ↗</a>
        </div>
        <button className="btn ghost small" onClick={async () => { await api('/api/admin/login', { method: 'DELETE' }); setState('login'); }}>Sair</button>
      </div>
      {!db && <p className="note err">Banco de dados não conectado. Dá para ver o painel, mas não salvar nem enviar fotos. {dbError}</p>}
      {msg && <p className={`note ${msg.kind}`} role="status">{msg.text}</p>}
      <div className="tabs" role="tablist">
        {(['fotos', 'servicos', 'horarios', 'contato'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`btn small ${tab === t ? '' : 'ghost'}`} onClick={() => setTab(t)}>
            {{ fotos: 'Fotos', servicos: 'Serviços e preços', horarios: 'Horários', contato: 'Contato' }[t]}
          </button>
        ))}
      </div>

      {tab === 'fotos' && (
        <>
          <div className="card drop">
            <label htmlFor="cat">Categoria das novas fotos</label>
            <select id="cat" value={uploadCat} onChange={(e) => setUploadCat(e.target.value as GalleryCategory)}>
              {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <p><label className="btn" style={{ display: 'inline-block', cursor: 'pointer', color: 'inherit' }}>
              {busy ? 'Enviando…' : '+ Escolher fotos do celular'}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
            </label></p>
            <small>Pode escolher várias de uma vez. As fotos são reduzidas automaticamente e entram no site na hora.</small>
          </div>
          <h2>Fotos enviadas por você ({s.photos.length})</h2>
          <div className="photos">
            {s.photos.map((p, i) => (
              <div className="ph" key={p.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt} loading="lazy" />
                <select aria-label="Categoria" value={p.category} onChange={(e) => set({ photos: s.photos.map((x, j) => (j === i ? { ...x, category: e.target.value as GalleryCategory } : x)) })}>
                  {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </select>
                <input aria-label="Descrição da foto" value={p.alt} onChange={(e) => set({ photos: s.photos.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)) })} />
                <button className="btn ghost small" style={{ marginTop: 6, width: '100%' }} onClick={() => confirm('Apagar esta foto?') && set({ photos: s.photos.filter((_, j) => j !== i) })}>Apagar</button>
              </div>
            ))}
          </div>
          <h2>Fotos fixas do site</h2>
          <p><small>Marque para esconder do site. Depois clique em Salvar.</small></p>
          {statics.map((p, i) => (
            <label key={p.alt} className="check card">
              <input type="checkbox" checked={!s.hiddenStatic.includes(i)} onChange={(e) => set({ hiddenStatic: e.target.checked ? s.hiddenStatic.filter((n) => n !== i) : [...s.hiddenStatic, i] })} />
              <span>{CATEGORY_LABEL[p.category]} · {p.alt}</span>
            </label>
          ))}
        </>
      )}

      {tab === 'servicos' && (
        <>
          {s.services.map((v, i) => {
            const up = (patch: Partial<typeof v>) => set({ services: s.services.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div className="card" key={v.id}>
                <label>Nome</label>
                <input value={v.name} onChange={(e) => up({ name: e.target.value })} />
                <label>Descrição</label>
                <input value={v.description} onChange={(e) => up({ description: e.target.value })} />
                <div className="row">
                  <div><label>Preço (R$)</label><input inputMode="decimal" value={String(v.priceCents / 100).replace('.', ',')} onChange={(e) => up({ priceCents: Math.round(Number(e.target.value.replace(',', '.')) * 100) || 0 })} /></div>
                  <div><label>Duração (min)</label><input inputMode="numeric" value={v.durationMinutes} onChange={(e) => up({ durationMinutes: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></div>
                </div>
                <label className="check"><input type="checkbox" checked={v.priceIsFrom} onChange={(e) => up({ priceIsFrom: e.target.checked })} /> Mostrar “a partir de”</label>
                <p><button className="btn ghost small" onClick={() => confirm('Remover este serviço?') && set({ services: s.services.filter((_, j) => j !== i) })}>Remover serviço</button></p>
              </div>
            );
          })}
          <button className="btn ghost" onClick={() => set({ services: [...s.services, { id: `servico-${Date.now()}`, name: 'Novo serviço', description: '', priceCents: 0, priceIsFrom: false, durationMinutes: 40 }] })}>+ Adicionar serviço</button>
        </>
      )}

      {tab === 'horarios' &&
        s.hours.map((h, i) => {
          const up = (patch: Partial<typeof h>) => set({ hours: s.hours.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div className="card" key={h.weekday}>
              <label className="check"><input type="checkbox" checked={h.isOpen} onChange={(e) => up(e.target.checked ? { isOpen: true, open: '07:00', close: '19:00' } : { isOpen: false, open: null, close: null, breakStart: null, breakEnd: null })} /> <strong>{DAYS[i]}</strong> — aberto</label>
              {h.isOpen && (
                <div className="row">
                  <div><label>Abre</label><input type="time" value={h.open ?? ''} onChange={(e) => up({ open: e.target.value })} /></div>
                  <div><label>Fecha</label><input type="time" value={h.close ?? ''} onChange={(e) => up({ close: e.target.value })} /></div>
                  <div><label>Almoço de</label><input type="time" value={h.breakStart ?? ''} onChange={(e) => up({ breakStart: e.target.value || null })} /></div>
                  <div><label>até</label><input type="time" value={h.breakEnd ?? ''} onChange={(e) => up({ breakEnd: e.target.value || null })} /></div>
                </div>
              )}
            </div>
          );
        })}

      {tab === 'contato' && (
        <div className="card">
          <label>WhatsApp (55 + DDD + número)</label>
          <input inputMode="numeric" value={s.business.whatsapp} onChange={(e) => biz({ whatsapp: e.target.value })} />
          <label>Instagram (só o nome, sem @)</label>
          <input value={s.business.instagram} onChange={(e) => biz({ instagram: e.target.value })} />
          <label>Endereço</label>
          <input value={s.business.address} onChange={(e) => biz({ address: e.target.value })} />
          <label>Link do Google Maps</label>
          <input value={s.business.mapsUrl} onChange={(e) => biz({ mapsUrl: e.target.value })} />
          <label>Frase de apresentação</label>
          <input value={s.business.specialty} onChange={(e) => biz({ specialty: e.target.value })} />
        </div>
      )}

      <div className="savebar">
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Aguarde…' : 'Salvar alterações'}</button>
      </div>
    </main>
  );
}
