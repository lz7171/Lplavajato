// Conexão compartilhada com o banco (MySQL/MariaDB/TiDB). Use só no servidor (pasta api/).
//
// SSL/TLS (igual ao "ssl-mode" do próprio MySQL):
//   - padrão (PREFERRED): tenta TLS; se o servidor responder que NÃO tem SSL, conecta sem TLS.
//   - ?ssl=false | ?sslmode=disable  na DATABASE_URL, ou DB_SSL=false  -> nunca usa TLS
//   - ?ssl=true  | ?sslmode=require  na DATABASE_URL, ou DB_SSL=true   -> TLS obrigatório
//   - DB_CA (opcional): certificado do provedor (Aiven etc.). Soma-se aos certificados públicos.
const tls = require('tls');
const mysql = require('mysql2/promise');

let pool = null;
let usandoTls = null; // true/false depois da 1ª conexão
let semTlsForcado = false; // virou true se o servidor disse que não tem SSL
const ouvintesTabela = [];

function erro(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

const limpar = (v) => String(v || '').trim().replace(/^(['"])(.*)\1$/s, '$2').trim();
const OFF = ['false', '0', 'off', 'no', 'disable', 'disabled'];
const ON = ['true', '1', 'on', 'yes', 'require', 'required', 'verify-ca', 'verify_ca', 'verify-full', 'verify_full', 'verify_identity'];

// Lê e valida DATABASE_URL (tolera aspas, espaços e quebra de linha sobrando no valor)
function lerUrl() {
  const raw = limpar(process.env.DATABASE_URL);
  if (!raw) throw erro('ENV_MISSING', 'DATABASE_URL não está definida no ambiente');
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw erro('ENV_INVALID', 'DATABASE_URL inválida. Formato: mysql://usuario:senha@host:3306/banco (senha com caracteres especiais precisa estar codificada, ex.: @ = %40, # = %23)');
  }
  if (!/^(mysql2?|mariadb):$/.test(u.protocol)) throw erro('ENV_INVALID', 'DATABASE_URL deve começar com mysql://');
  if (!u.hostname || u.pathname.length < 2) throw erro('ENV_INVALID', 'DATABASE_URL precisa ter host e nome do banco');
  return u;
}

function modoSsl(u) {
  const p = u.searchParams;
  const v = limpar(process.env.DB_SSL || p.get('ssl') || p.get('sslmode') || p.get('ssl-mode') || p.get('ssl_mode')).toLowerCase();
  if (OFF.includes(v)) return 'off';
  if (ON.includes(v) || v.startsWith('{')) return 'on'; // "{...}" = formato de URL do TiDB/PlanetScale
  if (['localhost', '127.0.0.1', '::1'].includes(u.hostname)) return 'off';
  return 'auto';
}

function decodificar(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function lerConfig() {
  const u = lerUrl();
  const modo = modoSsl(u);
  // DB_CA pode chegar com "\n" literal quando salvo em uma linha só
  const ca = limpar(process.env.DB_CA).replace(/\\n/g, '\n');
  const comTls = modo === 'on' || (modo === 'auto' && !semTlsForcado);
  return {
    modo,
    comTls,
    cfg: {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodificar(u.username),
      password: decodificar(u.password),
      database: decodificar(u.pathname.slice(1)),
      charset: 'utf8mb4',
      // "ca" substitui a lista padrão do Node; somamos os certificados públicos para não quebrar
      // provedores com certificado público (TiDB, PlanetScale) quando um DB_CA antigo ficou salvo.
      ...(comTls ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca: [...tls.rootCertificates, ca] } : {}) } } : {}),
      waitForConnections: true,
      connectionLimit: 2, // banco gratuito/compartilhado tem poucas conexões; a Vercel abre várias instâncias
      maxIdle: 1,
      idleTimeout: 20000, // devolve conexões paradas antes que o servidor as derrube
      connectTimeout: 10000,
      enableKeepAlive: true,
    },
  };
}

let modoAtual = 'auto';
function abrir() {
  const { modo, comTls, cfg } = lerConfig();
  modoAtual = modo;
  usandoTls = comTls;
  pool = mysql.createPool(cfg);
  return pool;
}

// Erros de conexão "velha" (o servidor fechou por inatividade): vale tentar de novo com outra conexão.
const TRANSITORIO = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'PROTOCOL_SEQUENCE_TIMEOUT'];
// Só repete comandos que não gravam nada (evita duplicar um INSERT)
const SEGURO_REPETIR = /^\s*(SELECT|SHOW|CREATE TABLE IF NOT EXISTS)\b/i;

async function trocarParaSemTls() {
  const velho = pool;
  semTlsForcado = true;
  pool = null;
  console.warn('[db] o servidor não aceita SSL; conectando sem TLS (para exigir TLS defina DB_SSL=true)');
  if (velho) velho.end().catch(() => {});
}

async function executar(metodo, args) {
  for (let tentativa = 0; ; tentativa++) {
    const p = pool || abrir();
    try {
      return await p[metodo](...args);
    } catch (e) {
      if (e.code === 'HANDSHAKE_NO_SSL_SUPPORT' && modoAtual === 'auto' && tentativa < 2) {
        if (!semTlsForcado) await trocarParaSemTls();
        continue; // (também cobre pedidos simultâneos que pegaram o pool antigo)
      }
      if (e.code === 'ER_NO_SUCH_TABLE') ouvintesTabela.forEach((f) => f());
      const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].sql) || '';
      if (tentativa === 0 && TRANSITORIO.includes(e.code) && (metodo === 'getConnection' || SEGURO_REPETIR.test(sql))) continue;
      throw e;
    }
  }
}

// Mesma interface que o pool do mysql2 (db().query, db().execute, db().getConnection)
const fachada = {
  query: (...a) => executar('query', a),
  execute: (...a) => executar('execute', a),
  getConnection: () => executar('getConnection', []),
};

function db() {
  return fachada;
}

// Chamado quando uma tabela some (ex.: banco recriado) para o _core recriar as tabelas.
function aoFaltarTabela(fn) {
  ouvintesTabela.push(fn);
}

function infoConexao() {
  return { tls: usandoTls, modoSsl: modoAtual };
}

// Explica o erro em português, sem expor senha/host (usado pelo painel e pelo /api/db-ping).
const DICAS = {
  ENV_MISSING: 'Defina DATABASE_URL nas variáveis de ambiente da Vercel e faça um novo deploy.',
  ENV_INVALID: 'DATABASE_URL está em formato errado. Use mysql://usuario:senha@host:3306/banco.',
  HANDSHAKE_NO_SSL_SUPPORT: 'O banco não tem SSL e DB_SSL=true está exigindo TLS. Remova DB_SSL ou use ?ssl=false na DATABASE_URL.',
  HANDSHAKE_SSL_ERROR: 'Falha no TLS. Confira o certificado (DB_CA) ou use ?ssl=false se o banco não tiver SSL.',
  ER_ACCESS_DENIED_ERROR: 'Usuário ou senha do banco incorretos na DATABASE_URL.',
  ER_DBACCESS_DENIED_ERROR: 'O usuário não tem permissão nesse banco. Confira o nome do banco na DATABASE_URL.',
  ER_BAD_DB_ERROR: 'O banco informado na DATABASE_URL não existe.',
  ER_HOST_NOT_PRIVILEGED: 'O banco bloqueou o IP da Vercel. Libere acesso remoto (host % ou 0.0.0.0/0) no painel do provedor.',
  ER_HOST_IS_BLOCKED: 'O banco bloqueou a Vercel por excesso de erros. Rode FLUSH HOSTS no provedor ou aguarde.',
  ER_TOO_MANY_USER_CONNECTIONS: 'Limite de conexões do usuário atingido (banco compartilhado). Aguarde alguns segundos.',
  ER_CON_COUNT_ERROR: 'O servidor do banco está com conexões esgotadas. Aguarde alguns segundos.',
  ER_USER_LIMIT_REACHED: 'Limite de uso por hora do banco gratuito atingido.',
  ENOTFOUND: 'O endereço (host) do banco não existe mais. O serviço pode ter sido desligado/apagado no provedor.',
  EAI_AGAIN: 'Falha temporária de DNS ao achar o banco. Tente de novo.',
  ECONNREFUSED: 'O servidor do banco recusou a conexão (porta errada ou serviço desligado).',
  ETIMEDOUT: 'O banco não respondeu a tempo (servidor desligado, porta bloqueada ou IP não liberado).',
  PROTOCOL_CONNECTION_LOST: 'A conexão com o banco caiu. Tente de novo.',
  ER_NO_SUCH_TABLE: 'Uma tabela não existia; ela é recriada sozinha. Atualize a página.',
  ER_TABLEACCESS_DENIED_ERROR: 'O usuário do banco não tem permissão para criar/alterar tabelas.',
  ER_NET_PACKET_TOO_LARGE: 'Arquivo grande demais para o banco (max_allowed_packet).',
};
const TLS_CERT = /CERT|SELF_SIGNED|UNABLE_TO|ERR_TLS|ERR_SSL|EPROTO/;
function explicarErro(e) {
  const code = (e && e.code) || 'UNKNOWN';
  const dica = DICAS[code] || (TLS_CERT.test(code) ? DICAS.HANDSHAKE_SSL_ERROR : 'Erro inesperado no banco. Veja os logs da função na Vercel.');
  return { code, dica };
}

module.exports = { db, aoFaltarTabela, infoConexao, explicarErro };
