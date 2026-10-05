const { db } = require("./_db");
const C = require("./_core");
const { SLOTS, bookableDates, weekDates, isBookableDate, nowInSaoPaulo, pastSlotsFor } = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Método não permitido." }); }

  const date = (req.query && req.query.date) || "";
  const now = nowInSaoPaulo();
  if (!date) return res.status(200).json({ dates: weekDates(now), available: bookableDates(now) });
  if (!isBookableDate(date, now)) return res.status(400).json({ error: "Data inválida ou fora dos dias de funcionamento." });

  try {
    await C.init();
    await C.sweep();
    const [rows] = await db().query("SELECT hora FROM agendamentos WHERE data=? AND slot_key IS NOT NULL", [date]);
    res.status(200).json({ date, allSlots: SLOTS, bookedSlots: rows.map((r) => r.hora), pastSlots: pastSlotsFor(date, now) });
  } catch (err) {
    console.error("slots error:", err);
    res.status(500).json({ error: "Não foi possível consultar os horários agora. Tente novamente em instantes." });
  }
};
