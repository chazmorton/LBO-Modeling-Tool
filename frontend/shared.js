const API_URL = "http://localhost:8000";

function getState() {
  try { return JSON.parse(localStorage.getItem("lbo_state") || "{}"); } catch { return {}; }
}

function setState(patch) {
  const s = { ...getState(), ...patch };
  localStorage.setItem("lbo_state", JSON.stringify(s));
}

function clearState() {
  localStorage.removeItem("lbo_state");
}

function buildNav(activePage) {
  const state = getState();
  const ticker = state.ticker || null;
  const validated = state.validated || false;

  const steps = [
    { label: "Validate Company", href: "index.html", num: 1 },
    { label: "LBO Model",        href: "lbo.html",   num: 2 },
    { label: "Monte Carlo",      href: "monte-carlo.html", num: 3 },
  ];

  const nav = document.getElementById("main-nav");
  nav.innerHTML = `<span class="nav-brand">LBO Tool</span><div class="nav-steps">${
    steps.map(s => {
      const isActive = s.num === activePage;
      const isLocked = s.num > 1 && !validated;
      return `<a class="nav-step${isActive ? " active" : ""}${isLocked ? " locked" : ""}" href="${isLocked ? "#" : s.href}">
        <span class="step-num">${s.num}</span>${s.label}
      </a>`;
    }).join("")
  }</div>${ticker ? `<span class="nav-ticker-badge">${ticker}</span>` : ""}
  <a href="about.html" style="margin-left:${ticker ? "12px" : "auto"};font-size:0.83rem;color:${activePage===0?"#f1f5f9":"#64748b"};text-decoration:none;padding:0 16px;height:56px;display:flex;align-items:center;border-bottom:2px solid ${activePage===0?"#ef4444":"transparent"};transition:color 0.2s;" onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='${activePage===0?"#f1f5f9":"#64748b"}'">About</a>`;
}

// Search dropdown shared logic
let _searchTimeout = null;

function initSearch(inputId, dropdownId, onSelect) {
  const input = document.getElementById(inputId);
  const dd    = document.getElementById(dropdownId);

  input.addEventListener("input", () => {
    clearTimeout(_searchTimeout);
    const q = input.value.trim();
    if (q.length < 2) { dd.style.display = "none"; return; }
    _searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.results?.length) { dd.style.display = "none"; return; }
        dd.innerHTML = data.results.map(r =>
          `<div class="dd-item" data-ticker="${r.ticker}">
            <span class="dd-ticker">${r.ticker}</span>
            <span class="dd-name">${r.name}</span>
            <span class="dd-exchange">${r.exchange}</span>
          </div>`
        ).join("");
        dd.style.display = "block";
        dd.querySelectorAll(".dd-item").forEach(el => {
          el.addEventListener("click", () => {
            input.value = el.dataset.ticker;
            dd.style.display = "none";
            onSelect(el.dataset.ticker);
          });
        });
      } catch (_) {}
    }, 350);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { dd.style.display = "none"; onSelect(input.value.trim()); }
    if (e.key === "Escape") dd.style.display = "none";
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(`#${dropdownId}`) && !e.target.closest(`#${inputId}`)) {
      dd.style.display = "none";
    }
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 7000);
}
