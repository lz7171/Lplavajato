'use client';

import { useEffect } from 'react';
import { BUSINESS } from '@/lib/config';
import { whatsappLink } from '@/lib/phone';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Erro na página', error.digest ?? '');
  }, [error]);

  return (
    <main className="page">
      <div className="wrap prose">
        <h1>Algo deu errado</h1>
        <p>Não conseguimos carregar esta página agora. Nenhuma informação sua foi perdida.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={reset}>
            Tentar novamente
          </button>
          <a className="btn wa-btn" href={whatsappLink(BUSINESS.whatsapp)} target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        </div>
        {error.digest && <p className="sub">Código do erro: {error.digest}</p>}
      </div>
    </main>
  );
}
