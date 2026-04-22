const API_URL = "http://localhost:8000";

let revenueChart, debtChart, cashflowChart, mcHistChart;
let searchTimeout = null;

function fmt(val) {
  if (val === null || val === undefined) return "N/A";
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M";
}

function pct(val) {
  if (val === null || val === undefined) return "N/A";
  return val + "%";
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 7000);
}

function destroyCharts() {
  [revenueChart, debtChart, cashflowChart].forEach((c) => c && c.destroy());
}

// ── Search ──────────────────────────────────────────────────────

function onSearchInput() {
  clearTimeout(searchTimeout);
  const q = document.getElementById("search-input").value.trim();
  if (q.length < 2) { closeDropdown(); return; }
  searchTimeout = setTimeout(() => fetchSuggestions(q), 350);
}

function onSearchKey(e) {
  if (e.key === "Enter") { closeDropdown(); loadCompany(); }
  if (e.key === "Escape") closeDropdown();
}

async function fetchSuggestions(q) {
  try {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const data = await res.json();
    renderDropdown(data.results);
  } catch (_) {}
}

function renderDropdown(results) {
  const dd = document.getElementById("search-dropdown");
  if (!results || results.length === 0) { closeDropdown(); return; }
  dd.innerHTML = results.map(r =>
    `<div class="dd-item" onclick="selectCompany('${r.ticker}', '${r.name.replace(/'/g, "\\'")}')">
      <span class="dd-ticker">${r.ticker}</span>
      <span class="dd-name">${r.name}</span>
      <span class="dd-exchange">${r.exchange}</span>
    </div>`
  ).join("");
  dd.style.display = "block";
}

function closeDropdown() {
  document.getElementById("search-dropdown").style.display = "none";
}

function selectCompany(ticker) {
  document.getElementById("search-input").value = ticker;
  closeDropdown();
  loadCompany(ticker);
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) closeDropdown();
});

async function loadCompany(tickerOverride) {
  const raw = tickerOverride || document.getElementById("search-input").value.trim();
  const ticker = raw.toUpperCase();
  if (!ticker) { showError("Enter a ticker symbol or company name first."); return; }

  const btn = document.getElementById("search-btn");
  btn.textContent = "Loading...";
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/company/${encodeURIComponent(ticker)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Company not found");
    }
    const d = await res.json();

    document.getElementById("revenue").value      = d.revenue;
    document.getElementById("growth_rate").value  = d.growth_rate;
    document.getElementById("ebitda_margin").value = d.ebitda_margin;
    document.getElementById("debt_percent").value  = d.debt_percent;
    document.getElementById("interest_rate").value = d.interest_rate;
    document.getElementById("exit_multiple").value = d.exit_multiple;
    document.getElementById("years").value         = d.years;

    const banner = document.getElementById("company-banner");
    banner.innerHTML = `
      <div class="banner-name">${d.name} <span class="banner-ticker">${d.ticker}</span></div>
      <div class="banner-meta">${[d.sector, d.industry].filter(Boolean).join(" · ")}</div>
      <div class="banner-note">Real data loaded from Yahoo Finance. Adjust assumptions as needed, then click Run Model.</div>
    `;
    banner.style.display = "block";

    ["revenue","growth_rate","ebitda_margin","debt_percent","interest_rate","exit_multiple","years"].forEach(id => {
      const el = document.getElementById(id);
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 800);
    });
  } catch (e) {
    showError("Could not load company: " + e.message);
  } finally {
    btn.textContent = "Load Data";
    btn.disabled = false;
  }
}

// ── LBO Model ───────────────────────────────────────────────────

const CHART_DEFAULTS = {
  responsive: true,
  plugins: { legend: { labels: { color: "#94a3b8", font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: "#64748b" }, grid: { color: "#1a1a1a" } },
    y: { ticks: { color: "#64748b" }, grid: { color: "#2a2a2a" } },
  },
};

function getInputs() {
  return {
    revenue:       parseFloat(document.getElementById("revenue").value),
    growth_rate:   parseFloat(document.getElementById("growth_rate").value) / 100,
    ebitda_margin: parseFloat(document.getElementById("ebitda_margin").value) / 100,
    debt_percent:  parseFloat(document.getElementById("debt_percent").value) / 100,
    interest_rate: parseFloat(document.getElementById("interest_rate").value) / 100,
    exit_multiple: parseFloat(document.getElementById("exit_multiple").value),
    years:         parseInt(document.getElementById("years").value),
  };
}

async function runLBO() {
  document.getElementById("error-msg").style.display = "none";
  const btn = document.getElementById("run-btn");
  btn.textContent = "Running...";
  btn.disabled = true;

  try {
    const response = await fetch(`${API_URL}/lbo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getInputs()),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Server error");
    }
    const result = await response.json();
    renderResults(result);
    document.getElementById("mc-section").style.display = "block";
  } catch (e) {
    showError("Error: " + e.message + ". Make sure the backend is running on localhost:8000.");
  } finally {
    btn.textContent = "Run Model";
    btn.disabled = false;
  }
}

function renderResults(r) {
  document.getElementById("irr-val").textContent      = r.irr !== null ? r.irr + "%" : "N/A";
  document.getElementById("exit-val").textContent     = fmt(r.exit_value);
  document.getElementById("equity-val").textContent   = fmt(r.equity_value);
  document.getElementById("purchase-val").textContent = fmt(r.purchase_price);
  document.getElementById("equity-in-val").textContent = fmt(r.initial_equity);

  const moic = r.initial_equity > 0 ? (r.equity_value / r.initial_equity).toFixed(2) + "x" : "N/A";
  document.getElementById("moic-val").textContent = moic;

  const tbody = document.querySelector("#financials-table tbody");
  tbody.innerHTML = "";
  r.years.forEach((yr, i) => {
    tbody.insertAdjacentHTML("beforeend", `<tr>
      <td>Year ${yr}</td>
      <td>${fmt(r.revenues[i])}</td>
      <td>${fmt(r.ebitda[i])}</td>
      <td>${fmt(r.interest_payments[i])}</td>
      <td>${fmt(r.debt_balances[i])}</td>
    </tr>`);
  });

  document.getElementById("results").style.display = "block";
  document.getElementById("charts-section").style.display = "grid";

  destroyCharts();
  const labels = r.years.map((y) => "Year " + y);

  revenueChart = new Chart(document.getElementById("revenueChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Revenue", data: r.revenues,  backgroundColor: "#ef444433", borderColor: "#ef4444", borderWidth: 2 },
        { label: "EBITDA",  data: r.ebitda,    backgroundColor: "#ffffff22", borderColor: "#e2e8f0", borderWidth: 2 },
      ],
    },
    options: CHART_DEFAULTS,
  });

  debtChart = new Chart(document.getElementById("debtChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Debt Balance", data: r.debt_balances, borderColor: "#ef4444", backgroundColor: "#ef444422", fill: true, tension: 0.3 },
      ],
    },
    options: CHART_DEFAULTS,
  });

  const cfLabels = ["Entry", ...labels];
  cashflowChart = new Chart(document.getElementById("cashflowChart"), {
    type: "bar",
    data: {
      labels: cfLabels,
      datasets: [
        {
          label: "Cash Flow",
          data: r.cash_flows,
          backgroundColor: r.cash_flows.map((v) => (v >= 0 ? "#ffffff33" : "#ef444466")),
          borderColor:      r.cash_flows.map((v) => (v >= 0 ? "#e2e8f0"   : "#ef4444")),
          borderWidth: 2,
        },
      ],
    },
    options: CHART_DEFAULTS,
  });
}

// ── Monte Carlo ─────────────────────────────────────────────────

async function runMonteCarlo() {
  document.getElementById("error-msg").style.display = "none";
  const btn = document.getElementById("mc-btn");
  btn.textContent = "Simulating...";
  btn.disabled = true;

  const inputs = getInputs();
  const n = parseInt(document.getElementById("mc-n").value) || 1000;
  const growthStd   = document.getElementById("mc-growth-std").value;
  const marginStd   = document.getElementById("mc-margin-std").value;
  const multipleStd = document.getElementById("mc-multiple-std").value;

  const payload = { ...inputs, simulations: n };
  if (growthStd)   payload.growth_std   = parseFloat(growthStd) / 100;
  if (marginStd)   payload.margin_std   = parseFloat(marginStd) / 100;
  if (multipleStd) payload.multiple_std = parseFloat(multipleStd);

  try {
    const res = await fetch(`${API_URL}/monte-carlo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Simulation failed");
    }
    const data = await res.json();
    renderMonteCarlo(data);
  } catch (e) {
    showError("Monte Carlo error: " + e.message);
  } finally {
    btn.textContent = "Run Simulation";
    btn.disabled = false;
  }
}

function renderMonteCarlo(data) {
  const irr = data.irr;

  document.getElementById("mc-median").textContent = pct(irr.median);
  document.getElementById("mc-mean").textContent   = pct(irr.mean);
  document.getElementById("mc-p10").textContent    = pct(irr.p10);
  document.getElementById("mc-p90").textContent    = pct(irr.p90);

  // Percentile table
  const tbody = document.getElementById("mc-table-body");
  tbody.innerHTML = [
    ["Simulations run", data.simulations],
    ["Min IRR",  pct(irr.min)],
    ["P10 (Bear)", pct(irr.p10)],
    ["P25",        pct(irr.p25)],
    ["Median",     pct(irr.median)],
    ["Mean",       pct(irr.mean)],
    ["P75",        pct(irr.p75)],
    ["P90 (Bull)", pct(irr.p90)],
    ["Max IRR",    pct(irr.max)],
    ["Median MOIC", data.moic?.median ? data.moic.median + "x" : "N/A"],
  ].map(([label, val]) => `<tr><td>${label}</td><td>${val}</td></tr>`).join("");

  // Histogram
  if (mcHistChart) mcHistChart.destroy();

  const hist = data.histogram;
  const midpoints = hist.edges.slice(0, -1).map((e, i) =>
    ((e + hist.edges[i + 1]) / 2).toFixed(1) + "%"
  );

  // Color bars: red below 0, white above
  const barColors = hist.edges.slice(0, -1).map((e) =>
    e < 0 ? "#ef444488" : "#ef444499"
  );
  const borderColors = hist.edges.slice(0, -1).map((e) =>
    e < 0 ? "#ef4444" : "#fca5a5"
  );

  mcHistChart = new Chart(document.getElementById("mcHistChart"), {
    type: "bar",
    data: {
      labels: midpoints,
      datasets: [{
        label: "Scenarios",
        data: hist.counts,
        backgroundColor: barColors,
        borderColor: borderColors,
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => "IRR ≈ " + items[0].label,
            label: (item) => item.raw + " scenarios",
          },
        },
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: "#64748b" }, grid: { color: "#2a2a2a" }, title: { display: true, text: "# Scenarios", color: "#64748b" } },
      },
    },
  });

  document.getElementById("mc-results").style.display = "block";
}
