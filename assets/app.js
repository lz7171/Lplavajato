// Os preços aqui e no HTML devem ser iguais aos de api/_lib.js (o servidor recalcula e valida o total).
(() => {
  const WHATSAPP_NUMBER = "5522998641962";
  const OPEN_DAYS = [0, 4, 5, 6];
  const DAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const state = { date: null, time: null, vehicle: null, vehiclePrice: 0, extras: new Map() };

  const datePillsEl = document.getElementById("date-pills");
  const slotGridEl = document.getElementById("slot-grid");
  const vehiclePillsEl = document.getElementById("vehicle-pills");
  const extrasPillsEl = document.getElementById("extras-pills");
  const formEl = document.getElementById("booking-form");
  const errorEl = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const sumWhen = document.getElementById("sum-when");
  const sumVehicle = document.getElementById("sum-vehicle");
  const sumExtras = document.getElementById("sum-extras");
  const sumTotal = document.getElementById("sum-total");

  function pad(n) { return String(n).padStart(2, "0"); }
  function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  function buildUpcomingDates(count) {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cursor = new Date(today);
    while (out.length < count) {
      if (OPEN_DAYS.includes(cursor.getDay())) out.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function renderDatePills() {
    const dates = buildUpcomingDates(8);
    datePillsEl.innerHTML = "";
    dates.forEach((d, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.setAttribute("aria-pressed", "false");
      btn.dataset.date = toISODate(d);
      btn.innerHTML = `${DAY_SHORT[d.getDay()]}<br>${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      btn.addEventListener("click", () => selectDate(btn.dataset.date));
      datePillsEl.appendChild(btn);
      if (i === 0) selectDate(btn.dataset.date);
    });
  }

  async function selectDate(iso) {
    state.date = iso;
    state.time = null;
    [...datePillsEl.children].forEach((el) => {
      const on = el.dataset.date === iso;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", String(on));
    });
    updateSummary();
    await renderSlots(iso);
  }

  async function renderSlots(iso) {
    slotGridEl.innerHTML = `<p class="slot-hint">Carregando horários…</p>`;
    let data;
    try {
      const res = await fetch(`/api/slots?date=${iso}`);
      data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar horários.");
      if (!Array.isArray(data.allSlots)) throw new Error("Resposta inválida.");
    } catch (err) {
      slotGridEl.innerHTML = `<p class="slot-hint">Não consegui carregar os horários agora. Tente novamente em instantes.</p>`;
      return;
    }

    const pastSlots = Array.isArray(data.pastSlots) ? data.pastSlots : [];

    slotGridEl.innerHTML = "";
    data.allSlots.forEach((time) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = time;
      btn.setAttribute("aria-pressed", "false");
      const isPast = pastSlots.includes(time);
      const isBooked = (data.bookedSlots || []).includes(time);
      if (isPast || isBooked) {
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => {
          state.time = time;
          [...slotGridEl.children].forEach((el) => {
            el.classList.remove("is-selected");
            el.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed", "true");
          updateSummary();
        });
      }
      slotGridEl.appendChild(btn);
    });
  }

  function wirePillGroup(container, multi) {
    container.querySelectorAll(".pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (multi) {
          const name = btn.dataset.extra;
          const price = Number(btn.dataset.price);
          if (state.extras.has(name)) { state.extras.delete(name); btn.classList.remove("is-selected"); btn.setAttribute("aria-pressed", "false"); }
          else { state.extras.set(name, price); btn.classList.add("is-selected"); btn.setAttribute("aria-pressed", "true"); }
        } else {
          state.vehicle = btn.dataset.vehicle;
          state.vehiclePrice = Number(btn.dataset.price);
          [...container.children].forEach((el) => {
            el.classList.remove("is-selected");
            el.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed", "true");
        }
        updateSummary();
      });
    });
  }

  function currentTotal() {
    let total = state.vehiclePrice || 0;
    for (const price of state.extras.values()) total += price;
    return total;
  }

  function updateSummary() {
    if (state.date && state.time) {
      const [y, m, d] = state.date.split("-").map(Number);
      const dObj = new Date(y, m - 1, d);
      sumWhen.textContent = `${DAY_LABEL[dObj.getDay()]}, ${pad(d)}/${pad(m)} às ${state.time}`;
    } else { sumWhen.textContent = "—"; }
    sumVehicle.textContent = state.vehicle ? `${state.vehicle} — R$ ${state.vehiclePrice}` : "—";
    sumExtras.textContent = state.extras.size ? [...state.extras.entries()].map(([n, p]) => `${n} (+${p})`).join(", ") : "Nenhum";
    sumTotal.textContent = `R$ ${currentTotal()}`;
  }

  function formatPhone(value) {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function isValidPhone(value) {
    const d = value.replace(/\D/g, "");
    if (d.length !== 10 && d.length !== 11) return false;
    if (!/^[1-9][1-9]/.test(d)) return false;
    return d.length === 10 || d[2] === "9";
  }

  function showError(msg) { errorEl.textContent = msg; errorEl.classList.add("is-visible"); }
  function clearError() { errorEl.textContent = ""; errorEl.classList.remove("is-visible"); }

  function buildWhatsAppMessage(name, phone) {
    const [y, m, d] = state.date.split("-").map(Number);
    const dObj = new Date(y, m - 1, d);
    const when = `${DAY_LABEL[dObj.getDay()]}, ${pad(d)}/${pad(m)} às ${state.time}`;
    const extrasLine = state.extras.size ? [...state.extras.entries()].map(([n, p]) => `  • ${n} (+R$ ${p})`).join("\n") : "  • Nenhum";
    return ["*Novo agendamento — LZ Lava-Jato*", "", `Nome: ${name}`, `WhatsApp: ${phone}`, `Dia/horário: ${when}`, `Veículo: ${state.vehicle} (R$ ${state.vehiclePrice})`, "Adicionais:", extrasLine, "", `*Total: R$ ${currentTotal()}*`].join("\n");
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    if (!state.date || !state.time) return showError("Escolha um dia e um horário.");
    if (!state.vehicle) return showError("Escolha o tipo de veículo.");
    if (name.length < 2) return showError("Informe seu nome.");
    if (!isValidPhone(phone)) return showError("Informe um WhatsApp válido com DDD, ex.: (22) 99999-9999.");

    submitBtn.disabled = true;
    submitBtn.textContent = "Reservando…";
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: state.date, time: state.time, name, phone, vehicle: state.vehicle, extras: [...state.extras.keys()] }),
      });
      let data = {};
      try { data = await res.json(); } catch (e) { /* resposta sem JSON */ }
      if (!res.ok) {
        showError(data.error || "Não foi possível reservar esse horário.");
        if (res.status === 409) await renderSlots(state.date);
        return;
      }
      const msg = buildWhatsAppMessage(name, phone);
      window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    } catch (err) {
      showError("Erro de conexão. Tente novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirmar e enviar no WhatsApp";
    }
  });

  const phoneEl = document.getElementById("phone");
  phoneEl.addEventListener("input", () => { phoneEl.value = formatPhone(phoneEl.value); });

  wirePillGroup(vehiclePillsEl, false);
  wirePillGroup(extrasPillsEl, true);
  renderDatePills();
  updateSummary();
})();
