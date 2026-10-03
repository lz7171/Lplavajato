const { kv } = require("@vercel/kv");
const L = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const body = L.readBody(req);
  const now = L.nowInSaoPaulo();

  const date = body.date;
  const time = body.time;
  const name = L.cleanName(body.name);
  const phone = L.cleanPhone(body.phone);
  const vehicle = L.cleanVehicle(body.vehicle);
  const extras = L.cleanExtras(body.extras);

  if (!L.isBookableDate(date, now)) {
    res.status(400).json({ error: "Escolha um dia da semana atual (quinta a domingo)." });
    return;
  }
  if (!L.isValidSlot(time)) {
    res.status(400).json({ error: `Escolha um horário válido (${L.SLOTS[0]}–${L.SLOTS[L.SLOTS.length - 1]}).` });
    return;
  }
  if (L.isPastSlot(date, time, now)) {
    res.status(400).json({ error: "Esse horário já passou. Escolha outro." });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "Informe seu nome (2 a 60 letras)." });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: "Informe um WhatsApp válido com DDD, ex.: (22) 99999-9999." });
    return;
  }
  if (!vehicle) {
    res.status(400).json({ error: "Escolha o tipo de veículo." });
    return;
  }
  if (!extras) {
    res.status(400).json({ error: "Adicionais inválidos." });
    return;
  }

  const setKey = `booked:${date}`;
  let reserved = false;

  try {
    const okIp = await L.withinLimit(kv, `rl:book:ip:${L.clientIp(req)}`, 6, 10 * 60);
    const okPhone = await L.withinLimit(kv, `rl:book:phone:${phone}`, 4, 60 * 60);
    if (!okIp || !okPhone) {
      res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
      return;
    }

    const added = await kv.sadd(setKey, time);
    if (added === 0) {
      res.status(409).json({ error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro." });
      return;
    }
    reserved = true;

    const ttl = L.ttlForDate(date);
    const total = L.computeTotal(vehicle, extras);
    await kv.expire(setKey, ttl);
    await kv.set(`detail:${date}:${time}`, { date, time, name, phone, vehicle, extras, total, createdAt: Date.now() }, { ex: ttl });

    res.status(200).json({ ok: true, date, time, total });
  } catch (err) {
    console.error("book error:", err);
    if (reserved) {
      // não deixa o horário preso se algo falhou depois de reservar
      try { await kv.srem(setKey, time); } catch (e) { console.error("rollback error:", e); }
    }
    res.status(500).json({ error: "Não foi possível reservar o horário agora. Tente novamente em instantes." });
  }
};
