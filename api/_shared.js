// Regras de negócio da LZ Lava-Jato — mantidas num só lugar
// para o front-end e as duas rotas de API nunca ficarem
// fora de sincronia.

const OPEN_DAYS = [0, 4, 5, 6]; // Dom, Qui, Sex, Sáb (0-6, 0 = domingo)
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
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${h}:${mm}`);
  }
  return slots;
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return false;
  }
  return OPEN_DAYS.includes(date.getUTCDay());
}

function isValidSlot(timeStr) {
  return buildSlots().includes(timeStr);
}

module.exports = { OPEN_DAYS, OPEN_TIME, CLOSE_TIME, SLOT_MINUTES, buildSlots, isValidDate, isValidSlot };
