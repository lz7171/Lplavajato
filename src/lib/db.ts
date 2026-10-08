import { rootCertificates } from 'node:tls';
import mysql, { type Pool } from 'mysql2/promise';

/**
 * Banco MySQL/MariaDB/TiDB via DATABASE_URL (mesmo esquema do LZ Lava-Jato).
 * SSL: padrão tenta TLS e, se o servidor não tiver, conecta sem. Force com DB_SSL=true/false
 * (ou ?ssl=true / ?ssl=false na URL). DB_CA é opcional (provedores com certificado próprio).
 */
export class DbError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const clean = (v: string | undefined) => (v ?? '').trim().replace(/^(['"])(.*)\1$/s, '$2').trim();
const OFF = ['false', '0', 'off', 'no', 'disable', 'disabled'];
const ON = ['true', '1', 'on', 'yes', 'require', 'required', 'verify-ca', 'verify_ca', 'verify-full', 'verify_full', 'verify_identity'];
const dec = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export const hasDb = () => clean(process.env.DATABASE_URL) !== '';

let pool: Pool | null = null;
let noTls = false;
let tablesReady = false;

function open(): Pool {
  const raw = clean(process.env.DATABASE_URL);
  if (!raw) throw new DbError('ENV_MISSING', 'DATABASE_URL não está definida');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new DbError('ENV_INVALID', 'DATABASE_URL inválida');
  }
  if (!/^(mysql2?|mariadb):$/.test(u.protocol) || !u.hostname || u.pathname.length < 2) throw new DbError('ENV_INVALID', 'DATABASE_URL deve ser mysql://usuario:senha@host:3306/banco');
  const p = u.searchParams;
  const v = clean(process.env.DB_SSL || p.get('ssl') || p.get('sslmode') || p.get('ssl-mode') || p.get('ssl_mode') || '').toLowerCase();
  const mode = OFF.includes(v) ? 'off' : ON.includes(v) || v.startsWith('{') ? 'on' : ['localhost', '127.0.0.1', '::1'].includes(u.hostname) ? 'off' : 'auto';
  const tls = mode === 'on' || (mode === 'auto' && !noTls);
  const ca = clean(process.env.DB_CA).replace(/\\n/g, '\n');
  pool = mysql.createPool({
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: dec(u.username),
    password: dec(u.password),
    database: dec(u.pathname.slice(1)),
    charset: 'utf8mb4',
    ...(tls ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca: [...rootCertificates, ca] } : {}) } } : {}),
    waitForConnections: true,
    connectionLimit: 2,
    maxIdle: 1,
    idleTimeout: 20000,
    connectTimeout: 10000,
    enableKeepAlive: true,
  });
  (pool as unknown as { __mode: string }).__mode = mode;
  return pool;
}

type Row = Record<string, unknown>;
/** Executa SQL com fallback sem TLS e nova tentativa em conexão caída (só em leituras). */
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    const p = pool ?? open();
    try {
      await ensureTables(p);
      const [rows] = await p.query(sql, params);
      return rows as T[];
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'HANDSHAKE_NO_SSL_SUPPORT' && (p as unknown as { __mode: string }).__mode === 'auto' && attempt < 2) {
        noTls = true;
        const old = pool;
        pool = null;
        tablesReady = false;
        void old?.end().catch(() => undefined);
        continue;
      }
      if (code === 'ER_NO_SUCH_TABLE') tablesReady = false;
      if (attempt === 0 && ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE'].includes(code) && /^\s*SELECT/i.test(sql)) continue;
      throw e;
    }
  }
}

async function ensureTables(p: Pool) {
  if (tablesReady) return;
  await p.query('CREATE TABLE IF NOT EXISTS jb_kv (k VARCHAR(60) NOT NULL PRIMARY KEY, v MEDIUMTEXT NOT NULL) DEFAULT CHARSET=utf8mb4');
  await p.query('CREATE TABLE IF NOT EXISTS jb_foto (id INT AUTO_INCREMENT PRIMARY KEY, mime VARCHAR(20) NOT NULL, img MEDIUMBLOB NOT NULL, criado_em BIGINT NOT NULL) DEFAULT CHARSET=utf8mb4');
  tablesReady = true;
}

const HINTS: Record<string, string> = {
  ENV_MISSING: 'Defina DATABASE_URL nas variáveis de ambiente da Vercel e faça um novo deploy.',
  ENV_INVALID: 'DATABASE_URL está em formato errado. Use mysql://usuario:senha@host:3306/banco (@ = %40, # = %23 na senha).',
  HANDSHAKE_NO_SSL_SUPPORT: 'O banco não tem SSL e DB_SSL=true exige TLS. Remova DB_SSL ou use ?ssl=false.',
  ER_ACCESS_DENIED_ERROR: 'Usuário ou senha do banco incorretos na DATABASE_URL.',
  ER_DBACCESS_DENIED_ERROR: 'O usuário não tem permissão nesse banco.',
  ER_BAD_DB_ERROR: 'O banco informado na DATABASE_URL não existe.',
  ER_HOST_NOT_PRIVILEGED: 'O banco bloqueou o IP da Vercel. Libere acesso remoto no provedor.',
  ENOTFOUND: 'O host do banco não existe mais (serviço desligado/apagado?).',
  ECONNREFUSED: 'O servidor do banco recusou a conexão (porta errada ou serviço desligado).',
  ETIMEDOUT: 'O banco não respondeu a tempo (desligado, porta bloqueada ou IP não liberado).',
  ER_TABLEACCESS_DENIED_ERROR: 'O usuário do banco não pode criar/alterar tabelas.',
  ER_NET_PACKET_TOO_LARGE: 'Foto grande demais para o banco (max_allowed_packet).',
  ER_USER_LIMIT_REACHED: 'Limite de uso por hora do banco gratuito atingido.',
};
export function explainDbError(e: unknown): { code: string; hint: string } {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  return { code, hint: HINTS[code] ?? 'Erro inesperado no banco. Veja os logs da função na Vercel.' };
}
