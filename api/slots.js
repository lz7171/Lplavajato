const { kv } = require("@vercel/kv");
const { SLOTS, isBookableDate, nowInSaoPaulo, pastSlotsFor } = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const date = (req.query && req.query.date) || "";
  const now = nowInSaoPaulo();

  if (!isBookableDate(date, now)) {
    res.status(400).json({ error: "Data inválida ou fora dos dias de funcionamento." });
    return;
  }

  try {
    const booked = await kv.smembers(`booked:${date}`);
    res.status(200).json({
      date,
      allSlots: SLOTS,
      bookedSlots: Array.isArray(booked) ? booked : [],
      pastSlots: pastSlotsFor(date, now),
    });
  } catch (err) {
    console.error("slots error:", err);
    res.status(500).json({ error: "Não foi possível consultar os horários agora. Tente novamente em instantes." });
  }
};
