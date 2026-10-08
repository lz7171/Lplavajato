'use client';

import Image, { type StaticImageData } from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CATEGORY_LABEL, GALLERY_CATEGORIES, type GalleryCategory } from '@/lib/gallery';

export type GalleryItem =
  | { kind: 'static'; key: string; category: GalleryCategory; src: StaticImageData; alt: string }
  | { kind: 'remote'; key: string; category: GalleryCategory; src: string; width: number; height: number; alt: string };

type Tab = 'todos' | GalleryCategory;

/** Imagem que some com elegância se o arquivo falhar (inexistente/quebrado). */
function GalleryImage({ item, sizes, eager = false }: { item: GalleryItem; sizes: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="img-fallback">Imagem indisponível</span>;
  if (item.kind === 'static') {
    return (
      <Image
        src={item.src}
        alt={item.alt}
        sizes={sizes}
        quality={70}
        placeholder="blur"
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <Image
      src={item.src}
      alt={item.alt}
      width={item.width}
      height={item.height}
      sizes={sizes}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Grade de trabalhos com abas por serviço: o cliente vê só o que interessa
 * sem rolar a página inteira. Sem JavaScript, mostra todas as fotos.
 * Abas seguem o padrão ARIA (setas, Home e End trocam de aba).
 */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const [tab, setTab] = useState<Tab>('todos');
  const [index, setIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: items.length },
    ...GALLERY_CATEGORIES.map((c) => ({ key: c as Tab, label: CATEGORY_LABEL[c], count: items.filter((i) => i.category === c).length })).filter(
      (t) => t.count > 0,
    ),
  ];
  const filtered = tab === 'todos' ? items : items.filter((i) => i.category === tab);
  const PREVIEW = 6;
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);

  const open = (i: number, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + visible.length) % visible.length)),
    [visible.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setIndex(null);
      triggerRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('keydown', onKey);
    return () => {
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('keydown', onKey);
    };
  }, [step]);

  const selectTab = (key: Tab, focus = false) => {
    setTab(key);
    setExpanded(false);
    if (focus) tabRefs.current.get(key)?.focus();
  };

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, position: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight' ? (position === last ? 0 : position + 1)
      : event.key === 'ArrowLeft' ? (position === 0 ? last : position - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target];
    if (next) selectTab(next.key, true);
  };

  const current = index === null ? null : visible[index];
  const panelId = `${uid}-painel`;

  return (
    <>
      {tabs.length > 2 && (
        <div className="gallery-tabs" role="tablist" aria-label="Filtrar trabalhos por serviço">
          {tabs.map((t, position) => (
            <button
              key={t.key}
              ref={(el) => {
                if (el) tabRefs.current.set(t.key, el);
                else tabRefs.current.delete(t.key);
              }}
              id={`${uid}-aba-${t.key}`}
              type="button"
              role="tab"
              className="chip"
              aria-selected={tab === t.key}
              aria-controls={panelId}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => selectTab(t.key)}
              onKeyDown={(e) => onTabKey(e, position)}
            >
              {t.label} <span className="tab-count">{t.count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="gallery" id={panelId} role={tabs.length > 2 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 2 ? `${uid}-aba-${tab}` : undefined}>
        {visible.map((item, i) => (
          <button key={item.key} type="button" onClick={(e) => open(i, e.currentTarget)} aria-label={`Ampliar foto: ${item.alt}`}>
            <GalleryImage item={item} sizes="(min-width: 1000px) 200px, (min-width: 700px) 25vw, 33vw" />
          </button>
        ))}
      </div>
      {filtered.length > PREVIEW && (
        <p className="gallery-more">
          <button type="button" className="btn ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Mostrar menos' : `Ver mais trabalhos (${filtered.length - PREVIEW})`}
          </button>
        </p>
      )}
      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label="Foto ampliada"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {current && (
          <figure>
            <GalleryImage key={current.key} item={current} sizes="(min-width: 760px) 720px, 92vw" eager />
            {/* Anunciado por leitores de tela ao passar para a próxima foto. */}
            <figcaption aria-live="polite">
              {current.alt}
              <span className="lb-count">
                {' '}
                · {(index ?? 0) + 1} de {visible.length}
              </span>
            </figcaption>
            <div className="lb-bar">
              <button type="button" className="btn ghost small" onClick={() => step(-1)} aria-label="Foto anterior" disabled={visible.length < 2}>
                ← Anterior
              </button>
              <button type="button" className="btn small" onClick={close}>
                Fechar
              </button>
              <button type="button" className="btn ghost small" onClick={() => step(1)} aria-label="Próxima foto" disabled={visible.length < 2}>
                Próxima →
              </button>
            </div>
          </figure>
        )}
      </dialog>
    </>
  );
}
