const { kv } = require("@vercel/kv");
const { isValidDate, isValidSlot } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { date, time, name, phone, vehicle, extras } = req.body || {};

  if (!isValidDate(date)) {
    res.status(400).json({ error: "Escolha um dia válido (quinta a domingo)." });
    return;
  }
  if (!isValidSlot(time)) {
    res.status(400).json({ error: "Escolha um horário válido (08:00–18:30)." });
    return;
  }
  if (!name || !phone || !vehicle) {
    res.status(400).json({ error: "Preencha todos os campos antes de confirmar." });
    return;
  }

  try {
    // SADD só adiciona se o horário ainda não estiver no conjunto do dia.
    // Isso é atômico no Redis: mesmo que dois clientes cliquem no mesmo
    // segundo, só um dos dois recebe added === 1.
    const added = await kv.sadd(`booked:${date}`, time);

    if (added === 0) {
      res.status(409).json({
        error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro.",
      });
      return;
    }

    await kv.set(
      `detail:${date}:${time}`,
      JSON.stringify({ name, phone, vehicle, extras: extras || [], createdAt: Date.now() }),
      { ex: 60 * 60 * 24 * 45 } // guarda por 45 dias, só de referência
    );

    res.status(200).json({ ok: true, date, time });
  } catch (err) {
    res.status(500).json({
      error:
        "Não foi possível reservar o horário. Verifique se o Vercel KV foi conectado a este projeto.",
    });
  }
};
