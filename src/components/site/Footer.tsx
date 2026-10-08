import Link from 'next/link';
import type { Biz } from '@/lib/config';
import { describeHours, type CatalogResult } from '@/lib/data/catalog';
import { formatPhone, whatsappLink } from '@/lib/phone';

export function Footer({ catalog, biz }: { catalog: CatalogResult; biz: Biz }) {
  const hours = catalog.ok ? describeHours(catalog.catalog.hours) : null;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <h3>{biz.name}</h3>
            <p>{biz.specialty}</p>
            {biz.address && (
              <p>
                {biz.mapsUrl ? (
                  <a href={biz.mapsUrl} target="_blank" rel="noopener noreferrer">
                    {biz.address}
                  </a>
                ) : (
                  biz.address
                )}
              </p>
            )}
          </div>
          <div>
            <h3>Horário</h3>
            {hours ? (
              <ul>
                {hours.map((h) => (
                  <li key={h.days}>
                    <strong>{h.days}:</strong> {h.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Consulte o horário pelo WhatsApp.</p>
            )}
          </div>
          <div>
            <h3>Contato</h3>
            <ul>
              <li>
                <a href={whatsappLink(biz.whatsapp)} target="_blank" rel="noopener noreferrer">
                  WhatsApp {formatPhone(biz.whatsapp)}
                </a>
              </li>
              {biz.instagram && (
                <li>
                  <a href={`https://instagram.com/${biz.instagram}`} target="_blank" rel="noopener noreferrer">
                    @{biz.instagram}
                  </a>
                </li>
              )}
              <li>
                <Link href="/privacidade">Privacidade</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="footer-bottom">© {biz.name}.</p>
      </div>
    </footer>
  );
}

export function WhatsAppButton({ biz }: { biz: Biz }) {
  return (
    <a
      className="wa"
      href={whatsappLink(biz.whatsapp, 'Olá, Jef! Vim pelo site.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar com o Jef no WhatsApp"
    >
      WhatsApp
    </a>
  );
}
