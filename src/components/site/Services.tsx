import type { CatalogResult } from '@/lib/data/catalog';
import type { Biz } from '@/lib/config';
import { whatsappLink } from '@/lib/phone';

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function Services({ catalog, biz }: { catalog: CatalogResult; biz: Biz }) {
  return (
    <section id="servicos" aria-labelledby="servicos-titulo">
      <div className="wrap">
        <h2 id="servicos-titulo">Serviços e preços</h2>
        <p className="sub">Preços atualizados pelo próprio Jef. Luzes e platinado variam conforme o comprimento e o volume do cabelo.</p>
        {catalog.ok ? (
          catalog.catalog.services.length > 0 ? (
            <ul className="serv">
              {catalog.catalog.services.map((s) => (
                <li key={s.id} className="rv">
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.description ? `${s.description} · ` : ''}
                      {duration(s.durationMinutes)}
                    </small>
                  </div>
                  <span className="price">
                    {s.priceIsFrom && <span className="from">a partir de</span>}
                    {s.priceLabel.replace('a partir de ', '')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nenhum serviço disponível no momento. Fale com o Jef pelo WhatsApp.</p>
          )
        ) : (
          <div className="msg warn" role="status">
            <p>Não foi possível carregar os serviços e preços agora.</p>
            <p>
              Consulte direto com o Jef:{' '}
              <a href={whatsappLink(biz.whatsapp, 'Olá, Jef! Quais são os serviços e preços?')} target="_blank" rel="noopener noreferrer">
                chamar no WhatsApp
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
