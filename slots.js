const { kv } = require("@vercel/kv");

const OPEN_DAYS = [0, 4, 5, 6]; // Dom, Qui, Sex, Sáb
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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const date = (req.query && req.query.date) || "";

  if (!isValidDate(date)) {
    res.status(400).json({ error: "Data inválida ou fora dos dias de funcionamento." });
    return;
  }

  try {
    const booked = await kv.smembers(`booked:${date}`);
    res.status(200).json({ date, allSlots: buildSlots(), bookedSlots: booked || [] });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível consultar os horários. Verifique se o Vercel KV foi conectado a este projeto." });
  }
};
