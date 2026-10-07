// Painel secreto (/lz-painel). Senha = variável ADMIN_PASSWORD no Vercel.
const crypto = require("crypto");
const { db, explicarErro } = require("./_db");
const C = require("./_core");
const L = require("./_lib");

// Hash (scrypt) da senha padrão do painel. Para trocar: defina ADMIN_PASSWORD no Vercel.
const DEFAULT_HASH = "8ede7243288eb568af850f0bc59208fe:5a1c13fa14e7fece9eb8070aef4a6c1681f5ab67cf40cc37d0c54364a143cd44";
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
// Tira espaços, quebra de linha e aspas que às vezes vêm junto ao salvar a variável na Vercel
const limpa = (v) => String(v || "").trim().replace(/^(['"])(.*)\1$/s, "$2").trim();

// Limite de tentativas em memória: usado só se o banco estiver fora (o painel ainda abre e mostra o erro)
const tentativas = new Map();
function limiteMemoria(chave, max, janelaMs) {
  const now = Date.now(), t = tentativas.get(chave);
  if (!t || t.ate < now) { tentativas.set(chave, { n: 1, ate: now + janelaMs }); return true; }
  t.n++;
  return t.n <= max;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const pass = limpa(process.env.ADMIN_PASSWORD); // se existir no Vercel, tem prioridade sobre a senha padrão

  try {
    const b = req.method === "POST" ? L.readBody(req) : {};

    // O painel pergunta se já está logado sem gerar erro 401 no console (e sem precisar do banco)
    if (req.method === "GET" && req.query && req.query.sessao !== undefined) return res.status(200).json({ logado: C.isAdmin(req) });

    if (b.action === "login") {
      const chave = `ad:${L.clientIp(req)}`;
      let dentro;
      try { await C.init(); dentro = await C.limite(chave, 6, 15 * 60e3); }
      catch (e) { console.error("admin login: banco indisponível, usando limite em memória:", e.code || e.message); dentro = limiteMemoria(chave, 6, 15 * 60e3); }
      if (!dentro) return res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos." });
      const given = limpa(String(b.password || "").slice(0, 200));
      if (pass && pass.length < 8) console.warn("ADMIN_PASSWORD tem menos de 8 caracteres; recomendo uma senha maior.");
      const okPass = pass ? same(given, pass) : C.checkPin(given, DEFAULT_HASH);
      if (!okPass) return res.status(401).json({ error: "Senha incorreta." });
      C.setCookie(res, "lz_a", C.sign({ t: "a", exp: Date.now() + 8 * 3600e3 }), 8 * 3600);
      return res.status(200).json({ ok: true });
    }
    if (b.action === "logout") { C.setCookie(res, "lz_a", "", 0); return res.status(200).json({ ok: true }); }
    if (!C.isAdmin(req)) return res.status(401).json({ error: "Sessão expirada. Entre de novo." });

    await C.init();
    await C.sweep();
    const q = (s, p) => db().query(s, p);

    if (req.method === "GET") {
      const now = L.nowInSaoPaulo();
      const [bookings] = await q("SELECT a.id,a.data,a.hora,a.veiculo,a.extras,a.total,a.status,a.expira_em,a.criado_em,c.id cliente_id,c.nome,c.telefone FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id WHERE a.data>=? ORDER BY a.data DESC,a.hora DESC LIMIT 1500", [L.addDays(now.date, -60)]);
      const [clientes] = await q("SELECT c.id,c.nome,c.telefone,c.strikes,c.bloqueado,c.criado_em,COALESCE(s.qtd,0) total,COALESCE(s.feitos,0) feitos,COALESCE(s.faltas,0) faltas,COALESCE(s.gasto,0) gasto FROM clientes c LEFT JOIN (SELECT cliente_id,COUNT(*) qtd,SUM(status='concluido') feitos,SUM(status='faltou') faltas,SUM(CASE WHEN status='concluido' THEN total ELSE 0 END) gasto FROM agendamentos WHERE cliente_id>0 GROUP BY cliente_id) s ON s.cliente_id=c.id ORDER BY c.criado_em DESC LIMIT 1500");
      const [bloqueios] = await q("SELECT id,data,hora FROM agendamentos WHERE status='bloqueado' AND data>=? ORDER BY data,hora", [now.date]);
      return res.status(200).json({ slots: L.SLOTS, servicos: { veiculos: Object.keys(L.VEHICLES), extras: Object.keys(L.EXTRAS) }, bloqueios, hoje: now.date, agora: Date.now(), holdMin: C.HOLD_MIN, bookings: bookings.map((x) => ({ ...C.shape(x), cliente_id: x.cliente_id, nome: x.nome, telefone: x.telefone, criado_em: Number(x.criado_em) })), clientes: clientes.map((c) => ({ ...c, total: +c.total, feitos: +c.feitos, faltas: +c.faltas, gasto: +c.gasto, criado_em: Number(c.criado_em), bloqueado: !!c.bloqueado })) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
    const id = parseInt(b.id, 10);
    if (["status", "liberar", "cliente"].includes(b.action) && !(id > 0)) return res.status(400).json({ error: "Registro inválido." });

    if (b.action === "status") {
      if (!["confirmado", "concluido", "faltou", "cancelado"].includes(b.status)) return res.status(400).json({ error: "Status inválido." });
      const [[a]] = await q("SELECT * FROM agendamentos WHERE id=?", [id]);
      if (!a) return res.status(404).json({ error: "Agendamento não encontrado." });
      const libera = b.status === "faltou" || b.status === "cancelado";
      try { await q("UPDATE agendamentos SET status=?, slot_key=?, expira_em=0 WHERE id=?", [b.status, libera ? null : `${a.data} ${a.hora}`, id]); }
      catch (e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esse horário já foi ocupado por outro agendamento." }); throw e; }
      // reativar uma falta/reserva expirada devolve o strike ao cliente
      if (["faltou", "expirado"].includes(a.status) && ["confirmado", "concluido"].includes(b.status)) await q("UPDATE clientes SET strikes=GREATEST(strikes-1,0) WHERE id=?", [a.cliente_id]);
      if (b.status === "faltou" && a.status !== "faltou") await q("UPDATE clientes SET strikes=strikes+1, bloqueado=IF(strikes>=?,1,bloqueado) WHERE id=?", [C.MAX_STRIKES, a.cliente_id]);
      return res.status(200).json({ ok: true });
    }
    if (b.action === "manual") {
      const nome = L.cleanName(b.nome), tel = L.cleanPhone(b.telefone), veic = L.cleanVehicle(b.veiculo), ex = L.cleanExtras(b.extras);
      if (!nome || !tel) return res.status(400).json({ error: "Informe nome e WhatsApp válidos (com DDD)." });
      if (!veic || !ex || !L.parseISODate(b.data) || !L.isValidSlot(b.hora)) return res.status(400).json({ error: "Data, horário ou serviço inválido." });
      const [[c]] = await q("SELECT id FROM clientes WHERE telefone=?", [tel]);
      let cid = c && c.id;
      if (!cid) {
        try { const [r] = await q("INSERT INTO clientes(nome,telefone,senha,criado_em) VALUES(?,?,?,?)", [nome, tel, C.hashPin(String(crypto.randomInt(10000000, 99999999))), Date.now()]); cid = r.insertId; }
        catch (e) { if (e.code !== "ER_DUP_ENTRY") throw e; const [[c2]] = await q("SELECT id FROM clientes WHERE telefone=?", [tel]); cid = c2 && c2.id; }
      }
      try { await q("INSERT INTO agendamentos(cliente_id,data,hora,veiculo,extras,total,status,slot_key,expira_em,criado_em) VALUES(?,?,?,?,?,?,'confirmado',?,0,?)", [cid, b.data, b.hora, veic, ex.join(","), L.computeTotal(veic, ex), `${b.data} ${b.hora}`, Date.now()]); }
      catch (e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esse horário já está ocupado ou bloqueado." }); throw e; }
      return res.status(200).json({ ok: true });
    }
    if (b.action === "bloquear") {
      const horas = b.hora === "todos" ? L.SLOTS : L.isValidSlot(b.hora) ? [b.hora] : null;
      if (!L.parseISODate(b.data) || !horas) return res.status(400).json({ error: "Data ou horário inválido." });
      let n = 0;
      for (const h of horas) {
        try { await q("INSERT INTO agendamentos(cliente_id,data,hora,veiculo,extras,total,status,slot_key,expira_em,criado_em) VALUES(0,?,?,'-','',0,'bloqueado',?,0,?)", [b.data, h, `${b.data} ${h}`, Date.now()]); n++; }
        catch (e) { if (e.code !== "ER_DUP_ENTRY") throw e; }
      }
      return res.status(200).json({ ok: true, bloqueados: n });
    }
    if (b.action === "liberar") {
      const [r] = await q("DELETE FROM agendamentos WHERE id=? AND status='bloqueado'", [id]);
      return r.affectedRows ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "Esse bloqueio já tinha sido liberado." });
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
    // só chega aqui com sessão de admin válida (ou no login, que já trata banco fora do ar)
    const { code, dica } = explicarErro(err);
    res.status(500).json({ error: "Erro ao acessar o banco de dados.", code, dica });
  }
};
