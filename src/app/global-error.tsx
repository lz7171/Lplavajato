'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ background: '#0e0e10', color: '#ecebe8', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1>Algo deu errado</h1>
        <p>O site encontrou um erro inesperado. Tente novamente em instantes.</p>
        <button type="button" onClick={reset} style={{ padding: '12px 20px', fontSize: 16 }}>
          Tentar novamente
        </button>
        {error.digest && <p>Código do erro: {error.digest}</p>}
      </body>
    </html>
  );
}
