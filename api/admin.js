// Painel secreto (/lz-painel). Senha = variável ADMIN_PASSWORD no Vercel.
const crypto = require("crypto");
const { db } = require("./_db");
const C = require("./_core");
const L = require("./_lib");

// Hash (scrypt) da senha padrão do painel. Para trocar: defina ADMIN_PASSWORD no Vercel.
const DEFAULT_HASH = "8ede7243288eb568af850f0bc59208fe:5a1c13fa14e7fece9eb8070aef4a6c1681f5ab67cf40cc37d0c54364a143cd44";
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const pass = process.env.ADMIN_PASSWORD; // se existir no Vercel, tem prioridade sobre a senha padrão

  try {
    await C.init();
    const b = req.method === "POST" ? L.readBody(req) : {};

    if (b.action === "login") {
      if (!(await C.limite(`ad:${L.clientIp(req)}`, 6, 15 * 60e3))) return res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos." });
      const given = String(b.password || "").slice(0, 100);
      const okPass = pass && pass.length >= 8 ? same(given, pass) : C.checkPin(given, DEFAULT_HASH);
      if (!okPass) return res.status(401).json({ error: "Senha incorreta." });
      C.setCookie(res, "lz_a", C.sign({ t: "a", exp: Date.now() + 8 * 3600e3 }), 8 * 3600);
      return res.status(200).json({ ok: true });
    }
    if (b.action === "logout") { C.setCookie(res, "lz_a", "", 0); return res.status(200).json({ ok: true }); }
    if (!C.isAdmin(req)) return res.status(401).json({ error: "Não autorizado." });

    await C.sweep();
    const q = (s, p) => db().query(s, p);

    if (req.method === "GET") {
      const now = L.nowInSaoPaulo();
      const [bookings] = await q("SELECT a.id,a.data,a.hora,a.veiculo,a.extras,a.total,a.status,a.expira_em,a.criado_em,c.id cliente_id,c.nome,c.telefone FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id WHERE a.data>=? ORDER BY a.data DESC,a.hora DESC LIMIT 1500", [L.addDays(now.date, -60)]);
      const [clientes] = await q("SELECT c.id,c.nome,c.telefone,c.strikes,c.bloqueado,c.criado_em,COUNT(a.id) total,COALESCE(SUM(a.status='concluido'),0) feitos,COALESCE(SUM(a.status='faltou'),0) faltas,COALESCE(SUM(CASE WHEN a.status='concluido' THEN a.total END),0) gasto FROM clientes c LEFT JOIN agendamentos a ON a.cliente_id=c.id GROUP BY c.id ORDER BY c.criado_em DESC LIMIT 1500");
      return res.status(200).json({ hoje: now.date, agora: Date.now(), holdMin: C.HOLD_MIN, bookings: bookings.map((x) => ({ ...C.shape(x), cliente_id: x.cliente_id, nome: x.nome, telefone: x.telefone, criado_em: Number(x.criado_em) })), clientes: clientes.map((c) => ({ ...c, total: +c.total, feitos: +c.feitos, faltas: +c.faltas, gasto: +c.gasto, criado_em: Number(c.criado_em), bloqueado: !!c.bloqueado })) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
    const id = parseInt(b.id, 10);

    if (b.action === "status") {
      if (!["confirmado", "concluido", "faltou", "cancelado"].includes(b.status)) return res.status(400).json({ error: "Status inválido." });
      const [[a]] = await q("SELECT * FROM agendamentos WHERE id=?", [id]);
      if (!a) return res.status(404).json({ error: "Agendamento não encontrado." });
      const libera = b.status === "faltou" || b.status === "cancelado";
      try { await q("UPDATE agendamentos SET status=?, slot_key=?, expira_em=0 WHERE id=?", [b.status, libera ? null : `${a.data} ${a.hora}`, id]); }
      catch (e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esse horário já foi ocupado por outro agendamento." }); throw e; }
      if (b.status === "faltou" && a.status !== "faltou") await q("UPDATE clientes SET strikes=strikes+1, bloqueado=IF(strikes>=?,1,bloqueado) WHERE id=?", [C.MAX_STRIKES, a.cliente_id]);
      return res.status(200).json({ ok: true });
    }
    if (b.action === "cliente") {
      if (b.op === "block") await q("UPDATE clientes SET bloqueado=1 WHERE id=?", [id]);
      else if (b.op === "unblock") await q("UPDATE clientes SET bloqueado=0, strikes=0 WHERE id=?", [id]);
      else if (b.op === "pin") {
        if (!/^\d{4,8}$/.test(String(b.pin || ""))) return res.status(400).json({ error: "Senha: 4 a 8 números." });
        await q("UPDATE clientes SET senha=? WHERE id=?", [C.hashPin(String(b.pin)), id]);
      } else return res.status(400).json({ error: "Operação inválida." });
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ error: "Ação inválida." });
  } catch (err) {
    console.error("admin error:", err);
    res.status(500).json({ error: "Erro ao acessar o banco de dados." });
  }
};
