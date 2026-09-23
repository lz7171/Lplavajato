const { kv } = require("@vercel/kv");

const OPEN_DAYS = [0, 4, 5, 6];
const OPEN_TIME = "08:00";
const CLOSE_TIME = "18:30";
const SLOT_MINUTES = 30;

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function buildSlots() {
  const start = timeToMinutes(OPEN_TIME);
  const end = timeToMinutes(CLOSE_TIME);
  const slots = [];
  for (let m = start; m <= end; m += SLOT_MINUTES) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  return OPEN_DAYS.includes(date.getUTCDay());
}

function isValidSlot(timeStr) {
  return buildSlots().includes(timeStr);
}

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
    // SADD só adiciona se o horário ainda não estiver no conjunto do dia —
    // atômico no Redis, então dois cliques no mesmo segundo nunca reservam
    // o mesmo horário duas vezes.
    const added = await kv.sadd(`booked:${date}`, time);

    if (added === 0) {
      res.status(409).json({ error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro." });
      return;
    }

    await kv.set(
      `detail:${date}:${time}`,
      JSON.stringify({ name, phone, vehicle, extras: extras || [], createdAt: Date.now() }),
      { ex: 60 * 60 * 24 * 45 }
    );

    res.status(200).json({ ok: true, date, time });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível reservar o horário. Verifique se o Vercel KV foi conectado a este projeto." });
  }
};
