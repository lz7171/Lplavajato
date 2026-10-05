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

  async function renderDatePills() {
    datePillsEl.innerHTML = `<p class="slot-hint">Carregando dias…</p>`;
    let dates, available;
    try {
      const res = await fetch("/api/slots");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.dates)) throw new Error("Resposta inválida.");
      dates = data.dates;
      available = Array.isArray(data.available) ? data.available : dates;
    } catch (err) {
      datePillsEl.innerHTML = `<p class="slot-hint">Não consegui carregar os dias agora. Atualize a página.</p>`;
      return;
    }
    datePillsEl.innerHTML = "";
    let first = null;
    dates.forEach((iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.setAttribute("aria-pressed", "false");
      btn.dataset.date = iso;
      btn.innerHTML = `${DAY_SHORT[new Date(y, m - 1, d).getDay()]}<br>${pad(d)}/${pad(m)}`;
      if (available.includes(iso)) {
        btn.addEventListener("click", () => selectDate(iso));
        if (!first) first = iso;
      } else {
        btn.disabled = true;
      }
      datePillsEl.appendChild(btn);
    });
    if (first) selectDate(first);
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
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const acctEl = $("acct"), mineEl = $("mine"), resultEl = $("result");
  function showError(msg) { errorEl.textContent = msg; errorEl.classList.add("is-visible"); }
  function clearError() { errorEl.textContent = ""; errorEl.classList.remove("is-visible"); }
  async function api(path, opts) {
    const r = await fetch(path, { credentials: "same-origin", ...opts });
    let d = {}; try { d = await r.json(); } catch (e) { /* sem JSON */ }
    return { ok: r.ok, status: r.status, d };
  }
  const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const whenLabel = (b) => { const [y, m, d] = b.data.split("-").map(Number); return `${DAY_LABEL[new Date(y, m - 1, d).getDay()]}, ${pad(d)}/${pad(m)} às ${b.hora}`; };
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function waLink(b) {
    const ex = b.extras.length ? b.extras.map((n) => `  • ${n}`).join("\n") : "  • Nenhum";
    const msg = ["*Novo agendamento — LZ Lava-Jato*", "", `Protocolo: #${b.id}`, `Nome: ${state.me.nome}`, `WhatsApp: ${formatPhone(state.me.telefone)}`, `Dia/horário: ${whenLabel(b)}`, `Veículo: ${b.veiculo}`, "Adicionais:", ex, "", `*Total: R$ ${b.total}*`].join("\n");
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  let list = [], mode = "login";
  function renderMine() {
    if (!state.me || !list.length) { mineEl.innerHTML = ""; return; }
    mineEl.innerHTML = `<div class="card"><h3>Meus agendamentos</h3>${list.map((b) => `<div class="row"><div><b>${esc(whenLabel(b))}</b> · ${esc(b.veiculo)} · R$ ${b.total}<small>${b.status === "confirmado" ? '<span class="ok">Confirmado</span>' : `<span class="wait">Aguardando confirmação</span> — envie a mensagem no WhatsApp até ${hhmm(b.expira_em)}`}</small></div><div>${b.status === "pendente" ? `<a class="btn btn-primary btn-sm" href="${waLink(b)}" target="_blank" rel="noopener">WhatsApp</a> ` : ""}<button type="button" class="btn btn-ghost btn-sm" data-cancel="${b.id}">Cancelar</button></div></div>`).join("")}</div>`;
    mineEl.querySelectorAll("[data-cancel]").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("Cancelar este agendamento?")) return;
      await api(`/api/book?id=${btn.dataset.cancel}`, { method: "DELETE" });
      resultEl.innerHTML = "";
      await refreshMe(); if (state.date) renderSlots(state.date);
    }));
  }
  async function refreshMe() {
    const { d } = await api("/api/auth");
    state.me = d.cliente || null; list = d.agendamentos || [];
    renderAcct(); renderMine();
  }
  function goAcct(msg) {
    if (msg) showError(msg);
    acctEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const f = $("a-phone"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 400);
  }
  function renderAcct() {
    const hc = $("head-cta"); if (hc) hc.textContent = state.me ? "Agendar" : "Entrar";
    submitBtn.textContent = state.me ? "Reservar horário" : "Entrar para reservar";
    acctEl.classList.toggle("gate", !state.me);
    if (state.me) {
      acctEl.innerHTML = `<p class="acct-hi">✔ Conectado como <b>${esc(state.me.nome)}</b> · ${esc(formatPhone(state.me.telefone))} <button type="button" class="link-btn" id="logout">Sair</button></p>${state.me.bloqueado ? '<p class="form-error is-visible">Sua conta está bloqueada para agendar online. Fale com a gente pelo WhatsApp.</p>' : ""}`;
      $("logout").onclick = async () => { await post("/api/auth", { action: "logout" }); resultEl.innerHTML = ""; await refreshMe(); };
      return;
    }
    const reg = mode === "register";
    acctEl.innerHTML = `<h3>${reg ? "Criar minha conta" : "Entre para agendar"}</h3><p>${reg ? "Leva 10 segundos: nome, WhatsApp e uma senha de 4 a 8 números." : "Use o WhatsApp e a senha que você cadastrou. Ainda não tem conta? Toque em Criar conta."}</p>
      <div class="pills"><button type="button" class="pill ${reg ? "" : "is-selected"}" data-m="login">Entrar</button><button type="button" class="pill ${reg ? "is-selected" : ""}" data-m="register">Criar conta</button></div>
      <form id="a-form" novalidate><div class="field-grid acct-fields">${reg ? '<div class="field"><label for="a-name">Nome</label><input id="a-name" maxlength="60" autocomplete="name"></div>' : ""}<div class="field"><label for="a-phone">WhatsApp</label><input id="a-phone" type="tel" inputmode="tel" maxlength="15" placeholder="(22) 99999-9999" autocomplete="tel-national"></div><div class="field"><label for="a-pin">Senha (4 a 8 números)</label><input id="a-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="${reg ? "new-password" : "current-password"}"></div></div>
      <button type="submit" class="btn btn-primary btn-sm" id="a-go">${reg ? "Criar minha conta" : "Entrar"}</button></form>`;
    acctEl.querySelectorAll("[data-m]").forEach((x) => x.addEventListener("click", () => { mode = x.dataset.m; clearError(); renderAcct(); }));
    const ph = $("a-phone"); ph.addEventListener("input", () => { ph.value = formatPhone(ph.value); });
    $("a-form").addEventListener("submit", async (e) => {
      e.preventDefault(); clearError();
      const go = $("a-go"); go.disabled = true;
      const r = await post("/api/auth", { action: mode, phone: ph.value, pin: $("a-pin").value, name: reg && $("a-name").value });
      go.disabled = false;
      if (!r.ok) return showError(r.d.error || "Não foi possível entrar agora.");
      await refreshMe();
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    if (!state.me) return goAcct("Primeiro entre ou crie sua conta aqui em cima para reservar.");
    if (!state.date || !state.time) return showError("Escolha um dia e um horário.");
    if (!state.vehicle) return showError("Escolha o tipo de veículo.");
    submitBtn.disabled = true;
    submitBtn.textContent = "Reservando…";
    try {
      const r = await post("/api/book", { date: state.date, time: state.time, vehicle: state.vehicle, extras: [...state.extras.keys()] });
      if (!r.ok) {
        showError(r.d.error || "Não foi possível reservar esse horário.");
        if (r.status === 409) await renderSlots(state.date);
        if (r.status === 401) { await refreshMe(); goAcct("Sua sessão expirou. Entre novamente para reservar."); }
        return;
      }
      const b = r.d.agendamento;
      resultEl.innerHTML = `<div class="card"><h3>Reserva criada!</h3><p>${esc(whenLabel(b))} · ${esc(b.veiculo)} · <b>R$ ${b.total}</b></p>${b.status === "pendente" ? `<p><span class="wait">Falta confirmar:</span> envie a mensagem no WhatsApp até <b>${hhmm(b.expira_em)}</b>. Depois disso o horário volta para a agenda.</p><a class="btn btn-primary" href="${waLink(b)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : `<p class="ok">Confirmado! Se quiser, avise no WhatsApp:</p><a class="btn btn-primary" href="${waLink(b)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`}</div>`;
      resultEl.scrollIntoView({ behavior: "smooth", block: "center" });
      state.time = null; updateSummary();
      await refreshMe(); await renderSlots(state.date);
    } catch (err) {
      showError("Erro de conexão. Tente novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = state.me ? "Reservar horário" : "Entrar para reservar";
    }
  });

  // quadro de serviços (fotos enviadas pelo painel)
  async function loadBoard() {
    const el = $("board"); if (!el) return;
    const { ok, d } = await api("/api/galeria");
    if (!ok || !d.fotos || !d.fotos.length) return;
    const hoje = toISODate(new Date()), ontem = toISODate(new Date(Date.now() - 864e5));
    const rot = (iso) => (iso === hoje ? "Hoje" : iso === ontem ? "Ontem" : `${iso.slice(8)}/${iso.slice(5, 7)}`);
    const g = {}; d.fotos.forEach((f) => (g[f.data] = g[f.data] || []).push(f));
    el.innerHTML = Object.keys(g).sort().reverse().map((day) => `<h3 class="board-day">${rot(day)}</h3><div class="gallery">${g[day].map((f) => `<figure><img src="/api/galeria?img=${f.id}" alt="${esc(f.legenda || "Serviço realizado")}" loading="lazy" decoding="async">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ""}</figure>`).join("")}</div>`).join("");
  }
  loadBoard();

  wirePillGroup(vehiclePillsEl, false);
  wirePillGroup(extrasPillsEl, true);
  renderDatePills();
  updateSummary();
  refreshMe();
  const hcta = $("head-cta"); if (hcta) hcta.addEventListener("click", () => { if (!state.me) setTimeout(() => goAcct(), 50); });

  // acesso discreto ao painel: 5 toques rápidos na logo do rodapé
  let taps = 0, tt;
  const fl = document.querySelector(".site-footer .brand-mark");
  if (fl) fl.addEventListener("click", () => { taps++; clearTimeout(tt); tt = setTimeout(() => { taps = 0; }, 1500); if (taps >= 5) location.href = "/lz-painel"; });

  // movimento: itens entram suavemente ao rolar a página
  const reveal = document.querySelectorAll(".price-row, .extras-list li, .gallery figure, .time-chips span");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    reveal.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", (i % 5) * 90 + "ms"); io.observe(el); });
  }
})();
