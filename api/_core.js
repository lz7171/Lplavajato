// Núcleo: tabelas, sessão, senha, limites e regras anti-"agendamento fantasma".
const crypto = require("crypto");
const { db } = require("./_db");

const HOLD_MIN = 90;     // reserva de cliente novo expira se o dono não confirmar
const MAX_STRIKES = 3;   // faltas/reservas expiradas até bloquear o agendamento online
const MAX_NEW = 1;       // agendamentos ativos: cliente novo
const MAX_TRUSTED = 2;   // cliente com ao menos 1 atendimento concluído

let ready;
function init() {
  if (!ready) ready = (async () => {
    const q = (s) => db().query(s);
    await q("CREATE TABLE IF NOT EXISTS clientes (id BIGINT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(60) NOT NULL, telefone VARCHAR(11) NOT NULL, senha VARCHAR(200) NOT NULL, strikes INT NOT NULL DEFAULT 0, bloqueado TINYINT NOT NULL DEFAULT 0, criado_em BIGINT NOT NULL, UNIQUE KEY uq_tel (telefone)) DEFAULT CHARSET=utf8mb4");
    await q("CREATE TABLE IF NOT EXISTS agendamentos (id BIGINT AUTO_INCREMENT PRIMARY KEY, cliente_id BIGINT NOT NULL, data CHAR(10) NOT NULL, hora CHAR(5) NOT NULL, veiculo VARCHAR(10) NOT NULL, extras VARCHAR(200) NOT NULL DEFAULT '', total INT NOT NULL, status VARCHAR(12) NOT NULL, slot_key VARCHAR(16) NULL, expira_em BIGINT NOT NULL DEFAULT 0, criado_em BIGINT NOT NULL, UNIQUE KEY uq_slot (slot_key), KEY ix_cli (cliente_id), KEY ix_data (data)) DEFAULT CHARSET=utf8mb4");
    await q("CREATE TABLE IF NOT EXISTS galeria (id BIGINT AUTO_INCREMENT PRIMARY KEY, data CHAR(10) NOT NULL, legenda VARCHAR(80) NOT NULL DEFAULT '', mime VARCHAR(20) NOT NULL, img MEDIUMBLOB NOT NULL, criado_em BIGINT NOT NULL, KEY ix_data (data)) DEFAULT CHARSET=utf8mb4");
    await q("CREATE TABLE IF NOT EXISTS limites (chave VARCHAR(80) PRIMARY KEY, n INT NOT NULL, ate BIGINT NOT NULL) DEFAULT CHARSET=utf8mb4");
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// ---- sessão (cookie HttpOnly assinado) ----
const secret = () => crypto.createHash("sha256").update(`${process.env.DATABASE_URL || ""}|${process.env.ADMIN_PASSWORD || ""}|lz`).digest();
function sign(p) {
  const b = Buffer.from(JSON.stringify(p)).toString("base64url");
  return b + "." + crypto.createHmac("sha256", secret()).update(b).digest("base64url");
}
function verify(tok) {
  if (typeof tok !== "string") return null;
  const [b, s] = tok.split(".");
  if (!b || !s) return null;
  const ok = crypto.createHmac("sha256", secret()).update(b).digest("base64url");
  if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  try { const p = JSON.parse(Buffer.from(b, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function cookies(req) {
  const o = {};
  String(req.headers.cookie || "").split(";").forEach((c) => { const i = c.indexOf("="); if (i > 0) o[c.slice(0, i).trim()] = c.slice(i + 1).trim(); });
  return o;
}
function setCookie(res, name, value, maxAge) {
  const prev = [].concat(res.getHeader("Set-Cookie") || []);
  res.setHeader("Set-Cookie", [...prev, `${name}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`]);
}
function login(res, id) { setCookie(res, "lz_c", sign({ t: "c", id, exp: Date.now() + 30 * 864e5 }), 30 * 86400); }

// ---- senha (scrypt) ----
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(pin, salt, 32).toString("hex");
}
function checkPin(pin, stored) {
  const [salt, h] = String(stored).split(":");
  if (!salt || !h) return false;
  const a = crypto.scryptSync(pin, salt, 32), b = Buffer.from(h, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- limite de tentativas (janela fixa, guardado no banco) ----
async function limite(chave, max, janelaMs) {
  const now = Date.now();
  await db().query("INSERT INTO limites(chave,n,ate) VALUES(?,1,?) ON DUPLICATE KEY UPDATE n=IF(ate<?,1,n+1), ate=IF(ate<?,?,ate)", [chave, now + janelaMs, now, now, now + janelaMs]);
  const [[r]] = await db().query("SELECT n FROM limites WHERE chave=?", [chave]);
  if (Math.random() < 0.02) db().query("DELETE FROM limites WHERE ate<?", [now]).catch(() => {});
  return r.n <= max;
}

// Libera reservas pendentes que ninguém confirmou e marca 1 falta (strike) para o cliente.
async function sweep() {
  const c = await db().getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query("SELECT id, cliente_id FROM agendamentos WHERE status='pendente' AND expira_em>0 AND expira_em<? FOR UPDATE", [Date.now()]);
    for (const r of rows) {
      await c.query("UPDATE agendamentos SET status='expirado', slot_key=NULL WHERE id=?", [r.id]);
      await c.query("UPDATE clientes SET strikes=strikes+1, bloqueado=IF(strikes>=?,1,bloqueado) WHERE id=?", [MAX_STRIKES, r.cliente_id]);
    }
    await c.commit();
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}

async function clientFrom(req) {
  const p = verify(cookies(req).lz_c);
  if (!p || p.t !== "c") return null;
  const [[row]] = await db().query("SELECT id,nome,telefone,strikes,bloqueado FROM clientes WHERE id=?", [p.id]);
  return row || null;
}
async function confiavel(id) {
  const [[r]] = await db().query("SELECT COUNT(*) n FROM agendamentos WHERE cliente_id=? AND status='concluido'", [id]);
  return r.n > 0;
}
async function publico(c) {
  return { id: c.id, nome: c.nome, telefone: c.telefone, bloqueado: !!c.bloqueado, confiavel: await confiavel(c.id), maxAtivos: (await confiavel(c.id)) ? MAX_TRUSTED : MAX_NEW };
}
const shape = (a) => ({ id: a.id, data: a.data, hora: a.hora, veiculo: a.veiculo, extras: a.extras ? a.extras.split(",") : [], total: a.total, status: a.status, expira_em: Number(a.expira_em) });
async function meus(id) {
  const today = require("./_lib").nowInSaoPaulo().date;
  const [rows] = await db().query("SELECT id,data,hora,veiculo,extras,total,status,expira_em FROM agendamentos WHERE cliente_id=? AND status IN ('pendente','confirmado') AND data>=? ORDER BY data,hora", [id, today]);
  return rows.map(shape);
}
function isAdmin(req) { const p = verify(cookies(req).lz_a); return !!p && p.t === "a"; }

module.exports = { HOLD_MIN, MAX_STRIKES, MAX_NEW, MAX_TRUSTED, init, sign, verify, cookies, setCookie, login, hashPin, checkPin, limite, sweep, clientFrom, confiavel, publico, shape, meus, isAdmin };
