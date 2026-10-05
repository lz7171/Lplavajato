const { db } = require("./_db");
const C = require("./_core");
const L = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await C.init();
    await C.sweep();
    const me = await C.clientFrom(req);
    if (!me) return res.status(401).json({ error: "Entre na sua conta para agendar." });

    if (req.method === "GET") return res.status(200).json({ agendamentos: await C.meus(me.id) });

    if (req.method === "DELETE") {
      const id = parseInt(req.query && req.query.id, 10);
      const [r] = await db().query("UPDATE agendamentos SET status='cancelado', slot_key=NULL WHERE id=? AND cliente_id=? AND status IN ('pendente','confirmado')", [id, me.id]);
      return res.status(200).json({ ok: r.affectedRows > 0 });
    }

    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST, DELETE"); return res.status(405).json({ error: "Método não permitido." }); }

    const body = L.readBody(req);
    const now = L.nowInSaoPaulo();
    const { date, time } = body;
    const vehicle = L.cleanVehicle(body.vehicle);
    const extras = L.cleanExtras(body.extras);

    if (!L.isBookableDate(date, now)) return res.status(400).json({ error: "Escolha um dia da semana atual (quinta a domingo)." });
    if (!L.isValidSlot(time)) return res.status(400).json({ error: "Escolha um horário válido." });
    if (L.isPastSlot(date, time, now)) return res.status(400).json({ error: "Esse horário não está mais disponível. Escolha outro." });
    if (!vehicle) return res.status(400).json({ error: "Escolha o tipo de veículo." });
    if (!extras) return res.status(400).json({ error: "Adicionais inválidos." });
    if (me.bloqueado) return res.status(403).json({ error: "Sua conta está bloqueada para agendar online. Fale com a gente pelo WhatsApp." });
    if (!(await C.limite(`bk:${me.id}`, 8, 3600e3))) return res.status(429).json({ error: "Muitas tentativas. Aguarde um pouco." });

    const trusted = await C.confiavel(me.id);
    const max = trusted ? C.MAX_TRUSTED : C.MAX_NEW;
    const [[{ n }]] = await db().query("SELECT COUNT(*) n FROM agendamentos WHERE cliente_id=? AND status IN ('pendente','confirmado') AND data>=?", [me.id, now.date]);
    if (n >= max) return res.status(409).json({ error: `Você já tem ${n} agendamento(s) ativo(s). O limite é ${max} por vez — cancele um ou aguarde o atendimento.` });

    const total = L.computeTotal(vehicle, extras);
    const status = trusted ? "confirmado" : "pendente";
    const expira = trusted ? 0 : Date.now() + C.HOLD_MIN * 60000;
    let id;
    try {
      const [r] = await db().query("INSERT INTO agendamentos(cliente_id,data,hora,veiculo,extras,total,status,slot_key,expira_em,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [me.id, date, time, vehicle, extras.join(","), total, status, `${date} ${time}`, expira, Date.now()]);
      id = r.insertId;
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro." });
      throw e;
    }
    res.status(200).json({ ok: true, agendamento: C.shape({ id, data: date, hora: time, veiculo: vehicle, extras: extras.join(","), total, status, expira_em: expira }) });
  } catch (err) {
    console.error("book error:", err);
    res.status(500).json({ error: "Não foi possível reservar o horário agora. Tente novamente em instantes." });
  }
};
