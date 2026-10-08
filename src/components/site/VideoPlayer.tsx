'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vídeo do espaço: só baixa quando chega perto da tela, toca sem som
 * enquanto visível e pausa fora da tela. Não toca sozinho para quem pediu
 * menos movimento. Se o vídeo falhar, fica a imagem de capa.
 */
export function VideoPlayer({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !('IntersectionObserver' in window)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!reduce) video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) video.play().catch(() => undefined);
  };

  return (
    <>
      <div className="phone">
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          controls
          controlsList="nodownload"
          aria-label="Vídeo mostrando o espaço da Jef Barber"
          onError={() => setFailed(true)}
        />
        {failed && <p className="video-error">Não foi possível carregar o vídeo agora.</p>}
      </div>
      <p style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="btn ghost small" type="button" onClick={toggleSound} disabled={failed}>
          {muted ? 'Ativar som' : 'Desativar som'}
        </button>
      </p>
    </>
  );
}
