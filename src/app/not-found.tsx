import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <div className="wrap prose">
        <h1>Página não encontrada</h1>
        <p>O endereço pode estar errado ou o link expirou.</p>
        <p>
          <Link className="btn" href="/">
            Ir para o início
          </Link>
        </p>
      </div>
    </main>
  );
}
