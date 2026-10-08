'use client';

import { useEffect, useRef } from 'react';

/** Brilho que acompanha o dedo/mouse no topo. Puramente decorativo. */
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const glow = ref.current;
    const hero = glow?.parentElement;
    if (!glow || !hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        glow.style.setProperty('--x', `${e.clientX - r.left}px`);
        glow.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    };
    hero.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', onMove);
    };
  }, []);
  return <div className="glow" ref={ref} aria-hidden="true" />;
}
