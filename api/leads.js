// CRUD de leads (formulário de contato).
//   POST   /api/leads              público: cria um lead
//   GET    /api/leads              admin: lista (?limit=50&offset=0&status=novo)
//   GET    /api/leads?id=1         admin: um lead
//   PATCH  /api/leads?id=1         admin: {"status":"lido"}  (novo | lido | respondido)
//   DELETE /api/leads?id=1         admin: remove
// Admin = header  Authorization: Bearer <ADMIN_TOKEN>  (variável de ambiente na Vercel).
//
// No front-end:
//   fetch('/api/leads', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ name, email, message, website: '' }),
//   }).then(r => r.json());
// "website" é uma armadilha para robôs: mantenha o campo escondido e vazio.

const crypto = require('crypto');
const { db, aoFaltarTabela } = require('./_db');

// Garante a tabela (igual a db/migrations/001_leads.sql) caso a migration não tenha rodado neste banco
let pronto;
function garantirTabela() {
  if (!pronto) pronto = db().query(`CREATE TABLE IF NOT EXISTS leads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL,
    message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'novo', ip_hash CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leads_created (created_at), INDEX idx_leads_ip (ip_hash, created_at)
  ) DEFAULT CHARSET=utf8mb4`).catch((e) => { pronto = null; throw e; });
  return pronto;
}
aoFaltarTabela(() => { pronto = null; });

const STATUS = ['novo', 'lido', 'respondido'];
const MAX_POR_HORA = 5; // envios por IP por hora
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLS = 'id, name, email, message, status, created_at';

function isAdmin(req) {
  const token = String(process.env.ADMIN_TOKEN || '').trim();
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !got) return false;
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

function bodyOf(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

function validate(b) {
  const data = {
    name: typeof b.name === 'string' ? b.name.trim() : '',
    email: typeof b.email === 'string' ? b.email.trim().toLowerCase() : '',
    message: typeof b.message === 'string' ? b.message.trim() : '',
  };
  const errors = {};
  if (data.name.length < 2 || data.name.length > 100) errors.name = 'Informe o nome (2 a 100 caracteres).';
  if (data.email.length > 190 || !EMAIL_RE.test(data.email)) errors.email = 'E-mail inválido.';
  if (data.message.length < 5 || data.message.length > 2000) errors.message = 'Mensagem de 5 a 2000 caracteres.';
  return { data, errors };
}

// guarda só um hash do IP (nunca o IP em si) para limitar abuso
function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + (process.env.ADMIN_TOKEN || '')).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const hasId = req.query && req.query.id !== undefined;
    const id = hasId ? Number(req.query.id) : null;
    if (hasId && (!Number.isInteger(id) || id < 1)) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }

    // ---- criar (público) ----
    if (req.method === 'POST') {
      await garantirTabela();
      const b = bodyOf(req);
      if (b.website) return res.status(201).json({ ok: true }); // robô: finge sucesso
      const { data, errors } = validate(b);
      if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });
      const pool = db();
      const h = ipHash(req);
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) AS total FROM leads WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL 1 HOUR)', [h]);
      if (total >= MAX_POR_HORA) {
        return res.status(429).json({ ok: false, error: 'Muitas mensagens. Tente de novo mais tarde.' });
      }
      const [r] = await pool.query(
        'INSERT INTO leads (name, email, message, ip_hash) VALUES (?, ?, ?, ?)',
        [data.name, data.email, data.message, h]);
      return res.status(201).json({ ok: true, id: r.insertId });
    }

    // ---- daqui para baixo: só admin ----
    if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({ ok: false, error: 'método não permitido' });
    }
    if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'não autorizado' });
    await garantirTabela();
    const pool = db();

    if (req.method === 'GET') {
      if (hasId) {
        const [rows] = await pool.query(`SELECT ${COLS} FROM leads WHERE id = ?`, [id]);
        return rows.length
          ? res.status(200).json({ ok: true, lead: rows[0] })
          : res.status(404).json({ ok: false, error: 'não encontrado' });
      }
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const status = STATUS.includes(req.query.status) ? req.query.status : null;
      const [rows] = await pool.query(
        `SELECT ${COLS} FROM leads ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT ? OFFSET ?`,
        status ? [status, limit, offset] : [limit, offset]);
      return res.status(200).json({ ok: true, leads: rows, limit, offset });
    }

    if (!hasId) return res.status(400).json({ ok: false, error: 'informe ?id=' });

    if (req.method === 'PATCH') {
      const st = bodyOf(req).status;
      if (!STATUS.includes(st)) {
        return res.status(422).json({ ok: false, errors: { status: 'Use: ' + STATUS.join(', ') } });
      }
      await pool.query('UPDATE leads SET status = ? WHERE id = ?', [st, id]);
      return res.status(200).json({ ok: true });
    }

    const [r] = await pool.query('DELETE FROM leads WHERE id = ?', [id]);
    return r.affectedRows
      ? res.status(200).json({ ok: true })
      : res.status(404).json({ ok: false, error: 'não encontrado' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'erro interno' });
  }
};
