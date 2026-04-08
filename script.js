const fallbackGames = [
  { home: "Flamengo", away: "Vasco", probabilities: { H: 0.65, D: 0.1, A: 0.25 } },
  { home: "Corinthians", away: "Santos", probabilities: { H: 0.58, D: 0.23, A: 0.19 } },
  { home: "Sao Paulo", away: "Bragantino", probabilities: { H: 0.56, D: 0.24, A: 0.2 } },
  { home: "Palmeiras", away: "Atletico-GO", probabilities: { H: 0.7, D: 0.16, A: 0.14 } },
  { home: "Atletico-MG", away: "Cruzeiro", probabilities: { H: 0.49, D: 0.27, A: 0.24 } },
  { home: "Gremio", away: "Internacional", probabilities: { H: 0.41, D: 0.31, A: 0.28 } },
  { home: "Fluminense", away: "Botafogo", probabilities: { H: 0.44, D: 0.29, A: 0.27 } },
  { home: "Bahia", away: "Fortaleza", probabilities: { H: 0.46, D: 0.28, A: 0.26 } },
  { home: "Athletico-PR", away: "Goias", probabilities: { H: 0.54, D: 0.25, A: 0.21 } },
  { home: "Cuiaba", away: "Juventude", probabilities: { H: 0.48, D: 0.29, A: 0.23 } },
  { home: "America-MG", away: "Ceara", probabilities: { H: 0.42, D: 0.3, A: 0.28 } },
  { home: "Vitoria", away: "Sport", probabilities: { H: 0.4, D: 0.31, A: 0.29 } },
  { home: "Coritiba", away: "Parana", probabilities: { H: 0.52, D: 0.27, A: 0.21 } },
  { home: "Ponte Preta", away: "Guarani", probabilities: { H: 0.39, D: 0.32, A: 0.29 } }
];

const outcomeLabel = { H: "Casa", D: "Empate", A: "Fora" };
let games = [];
let compositions = [];
let selectedComposition = null;
let appliedPicks = [];
let selectedRiskPreset = "medio";
let abSnapshotA = null;
let abSnapshotB = null;
let currentContestNumber = "";
let currentContestDate = "";
const STORAGE_KEY = "loesin_ticket_v12";
const HISTORY_KEY = "loesin_history_v1";
const ROUND_DATA_KEY = "loesin_round_data_v1";
const LOG_KEY = "loesin_error_log_v1";
const CONTEST_MEMORY_KEY = "loesin_contest_memory_v1";
const MONTE_CARLO_RUNS = 10000;
const RISK_PRESETS = {
  baixo: { duplos: 3, triplos: 0, label: "Baixo risco" },
  medio: { duplos: 4, triplos: 1, label: "Medio risco" },
  alto: { duplos: 5, triplos: 2, label: "Alto risco" }
};

async function loadGames() {
  try {
    const response = await fetch("./data/games.json");
    if (!response.ok) throw new Error("mock data unavailable");
    return await response.json();
  } catch (_error) {
    return fallbackGames;
  }
}

function appendLog(message, level = "info") {
  const entry = `[${new Date().toLocaleString("pt-BR")}] ${level.toUpperCase()}: ${message}`;
  let logs = [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    logs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(logs)) logs = [];
  } catch (_error) {
    logs = [];
  }
  logs = [entry, ...logs].slice(0, 50);
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  renderErrorLogs();
}

function renderErrorLogs() {
  const el = document.getElementById("error-log");
  if (!el) return;
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    el.textContent = Array.isArray(logs) && logs.length ? logs.join("\n") : "Sem logs.";
  } catch (_error) {
    el.textContent = "Sem logs.";
  }
}

function setRoundStatus(message, isError = false) {
  const el = document.getElementById("round-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function setRoundBadge(mode) {
  const badge = document.getElementById("round-badge");
  if (!badge) return;
  if (mode === "official") {
    badge.textContent = "Status da rodada: IMPORTADA (concurso atual)";
    badge.style.background = "#ecfeff";
    badge.style.color = "#155e75";
    badge.style.borderColor = "#a5f3fc";
  } else {
    badge.textContent = "Status da rodada: MOCK (exemplo)";
    badge.style.background = "#fff7ed";
    badge.style.color = "#9a3412";
    badge.style.borderColor = "#fed7aa";
  }
}

function refreshContestMetaDisplay() {
  const meta = document.getElementById("contest-meta");
  const numInput = document.getElementById("contest-number-input");
  const dateInput = document.getElementById("contest-date-input");
  if (numInput) numInput.value = currentContestNumber;
  if (dateInput) dateInput.value = currentContestDate;
  if (meta) {
    meta.textContent = `Concurso: ${currentContestNumber || "-"} | Data: ${currentContestDate || "-"}`;
  }
}

function extractRoundPayload(input) {
  if (Array.isArray(input)) return { games: input, contestNumber: "", contestDate: "" };
  if (input && typeof input === "object" && Array.isArray(input.games)) {
    return {
      games: input.games,
      contestNumber: String(input.contestNumber || ""),
      contestDate: String(input.contestDate || "")
    };
  }
  return { games: null, contestNumber: "", contestDate: "" };
}

function validateRoundGames(rawGames) {
  if (!Array.isArray(rawGames) || rawGames.length !== 14) {
    return { ok: false, reason: "A rodada precisa conter exatamente 14 jogos." };
  }
  for (const game of rawGames) {
    if (!game || typeof game.home !== "string" || typeof game.away !== "string" || !game.probabilities) {
      return { ok: false, reason: "Cada jogo precisa de home, away e probabilities." };
    }
    const h = Number(game.probabilities.H);
    const d = Number(game.probabilities.D);
    const a = Number(game.probabilities.A);
    if (![h, d, a].every((x) => Number.isFinite(x) && x >= 0 && x <= 1)) {
      return { ok: false, reason: "Probabilidades devem estar entre 0 e 1." };
    }
    const sum = h + d + a;
    if (Math.abs(sum - 1) > 0.02) {
      return { ok: false, reason: `Probabilidades de ${game.home} x ${game.away} nao somam ~1.` };
    }
  }
  return { ok: true };
}

function parseRoundCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV vazio.");
  const header = lines[0].toLowerCase();
  if (!header.includes("home") || !header.includes("away") || !header.includes("h") || !header.includes("d") || !header.includes("a")) {
    throw new Error("Cabecalho CSV esperado: home,away,H,D,A");
  }
  return lines.slice(1).map((line) => {
    const [home, away, h, d, a] = line.split(",").map((v) => v.trim());
    return { home, away, probabilities: { H: Number(h), D: Number(d), A: Number(a) } };
  });
}

function reinitializeRound(rawGames) {
  games = buildAnalysis(rawGames).slice(0, 14);
  compositions = buildCompositions();
  selectedComposition = compositions.find((c) => c.recommended) || compositions[1] || compositions[0];
  appliedPicks = applyComposition(games, pickSecas(games), selectedComposition);
  selectedRiskPreset = "medio";
  renderGames(appliedPicks);
  renderSuggestions(pickSecas(games));
  renderCompositions();
  updateResult(appliedPicks);
  syncRiskPresetControl();
  refreshContestMetaDisplay();
  saveState();
}

function orderOutcomes(probabilities) {
  return Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
}

function buildAnalysis(rawGames) {
  return rawGames.map((game, idx) => {
    const ordered = orderOutcomes(game.probabilities);
    return {
      ...game,
      id: idx + 1,
      best: ordered[0][0],
      bestProb: ordered[0][1],
      second: ordered[1][0],
      secondProb: ordered[1][1],
      confidenceMargin: ordered[0][1] - ordered[1][1]
    };
  });
}

function pickSecas(analysis) {
  return [...analysis]
    .sort((a, b) => b.confidenceMargin - a.confidenceMargin)
    .slice(0, 8);
}

function compositionMetrics(duplos, triplos) {
  const combos = 2 ** duplos * 3 ** triplos;
  const cost = combos;
  const coverage = ((duplos + triplos * 2) / 14) * 100;
  const score = coverage / cost;
  return { duplos, triplos, combos, cost, coverage, score };
}

function buildCompositions() {
  const all = [];
  for (let d = 2; d <= 6; d += 1) {
    for (let t = 0; t <= 2; t += 1) {
      all.push(compositionMetrics(d, t));
    }
  }
  const pickByProfile = (targetDuplos, targetTriplos) =>
    all.find((c) => c.duplos === targetDuplos && c.triplos === targetTriplos) ||
    compositionMetrics(targetDuplos, targetTriplos);

  // Perfis padrao de custo/cobertura para manter coerencia da experiencia.
  const conservative = pickByProfile(3, 0);
  const balanced = pickByProfile(4, 1);
  const aggressive = pickByProfile(5, 2);

  return [
    { name: "Conservadora", ...conservative, strategy: "baixo custo" },
    { name: "Equilibrada", ...balanced, strategy: "melhor equilibrio", recommended: true },
    { name: "Agressiva", ...aggressive, strategy: "maxima cobertura" }
  ];
}

function applyComposition(analysis, secas, composition) {
  const secaIds = new Set(secas.map((s) => s.id));
  const lowConfidence = [...analysis]
    .filter((g) => !secaIds.has(g.id))
    .sort((a, b) => a.confidenceMargin - b.confidenceMargin);

  const triploIds = new Set(lowConfidence.slice(0, composition.triplos).map((g) => g.id));
  const duploIds = new Set(
    lowConfidence
      .filter((g) => !triploIds.has(g.id))
      .slice(0, composition.duplos)
      .map((g) => g.id)
  );

  return analysis.map((game) => {
    const ordered = orderOutcomes(game.probabilities);
    let picks = [ordered[0][0]];
    if (triploIds.has(game.id)) {
      picks = ["H", "D", "A"];
    } else if (duploIds.has(game.id)) {
      picks = [ordered[0][0], ordered[1][0]];
    }
    return { ...game, picks };
  });
}

function normalizeManualPicks(input) {
  const values = Array.isArray(input) ? input.filter((v) => ["H", "D", "A"].includes(v)) : [];
  return [...new Set(values)];
}

function saveState() {
  const payload = {
    selectedComposition: selectedComposition ? selectedComposition.name : null,
    selectedRiskPreset,
    picks: appliedPicks.map((g) => ({ id: g.id, picks: g.picks }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
}

function loadContestMemory() {
  try {
    const raw = localStorage.getItem(CONTEST_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function saveContestMemory(memory) {
  localStorage.setItem(CONTEST_MEMORY_KEY, JSON.stringify(memory));
}

function createPortableSnapshot(label = "Volante compartilhado") {
  const distribution = getDistribution(appliedPicks);
  return {
    version: "2.0.0",
    label,
    timestamp: new Date().toISOString(),
    selectedRiskPreset,
    selectedComposition: selectedComposition ? selectedComposition.name : null,
    distribution: `${distribution.duplos}D/${distribution.triplos}T`,
    picks: appliedPicks.map((g) => ({ id: g.id, picks: g.picks }))
  };
}

function saveCurrentContestSnapshot(contestNumber) {
  const memory = loadContestMemory();
  memory[String(contestNumber)] = {
    ...createPortableSnapshot(`Concurso ${contestNumber}`),
    contestNumber: String(contestNumber),
    contestDate: currentContestDate || ""
  };
  saveContestMemory(memory);
}

function getContestSnapshot(contestNumber) {
  const memory = loadContestMemory();
  return memory[String(contestNumber)] || null;
}

function validateSnapshot(input) {
  if (!input || typeof input !== "object") return { ok: false, reason: "JSON invalido." };
  if (!Array.isArray(input.picks) || input.picks.length !== games.length) {
    return { ok: false, reason: "Estrutura de picks invalida para 14 jogos." };
  }
  const allValid = input.picks.every((item) => {
    if (!item || typeof item.id !== "number" || !Array.isArray(item.picks)) return false;
    const normalized = normalizeManualPicks(item.picks);
    return normalized.length > 0;
  });
  if (!allValid) return { ok: false, reason: "Picks contem valores invalidos." };
  return { ok: true };
}

function setImportStatus(message, isError = false) {
  const el = document.getElementById("import-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function setAbStatus(message, isError = false) {
  const el = document.getElementById("ab-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function setContestStatus(message, isError = false) {
  const el = document.getElementById("contest-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function chanceOfHit(ticket) {
  const p = ticket.reduce((acc, game) => {
    const coveredProb = game.picks.reduce((sum, symbol) => sum + game.probabilities[symbol], 0);
    return acc * coveredProb;
  }, 1);
  return Math.max(0, Math.min(1, p));
}

function computeTicketStats(ticket) {
  const p14 = chanceOfHit(ticket);
  const inv = p14 > 0 ? Math.round(1 / p14) : 0;
  const distribution = getDistribution(ticket);
  const combos = distribution.duplos > 0 || distribution.triplos > 0
    ? 2 ** distribution.duplos * 3 ** distribution.triplos
    : 1;
  const coverage = ((distribution.duplos + distribution.triplos * 2) / 14) * 100;
  return { p14, inv, distribution, combos, coverage };
}

function ticketFromSnapshot(snapshot) {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return null;
  const comp = compositions.find((c) => c.name === snapshot.selectedComposition) || selectedComposition;
  const ticket = applyComposition(games, pickSecas(games), comp);
  snapshot.picks.forEach((saved) => {
    const match = ticket.find((g) => g.id === saved.id);
    const picks = normalizeManualPicks(saved.picks);
    if (match && picks.length > 0) match.picks = picks;
  });
  return ticket;
}

function parseOfficialResult(input) {
  if (!input || typeof input !== "string") return null;
  const normalized = input
    .toUpperCase()
    .replace(/1/g, "H")
    .replace(/X/g, "D")
    .replace(/2/g, "A")
    .replace(/[^HDA]/g, "");
  if (normalized.length !== 14) return null;
  return normalized.split("");
}

function countHitsForTicket(ticket, resultSymbols) {
  let hits = 0;
  for (let i = 0; i < 14; i += 1) {
    if (ticket[i] && ticket[i].picks.includes(resultSymbols[i])) hits += 1;
  }
  return hits;
}

function renderABCompare() {
  const root = document.getElementById("ab-compare");
  if (!root) return;
  root.innerHTML = "";
  if (!abSnapshotA || !abSnapshotB) return;

  const ticketA = ticketFromSnapshot(abSnapshotA);
  const ticketB = ticketFromSnapshot(abSnapshotB);
  if (!ticketA || !ticketB) {
    setAbStatus("Um dos JSONs A/B e invalido.", true);
    return;
  }

  const a = computeTicketStats(ticketA);
  const b = computeTicketStats(ticketB);
  const scoreA = a.p14 / Math.max(1, a.combos);
  const scoreB = b.p14 / Math.max(1, b.combos);
  const best = scoreA >= scoreB ? "A" : "B";

  const createCard = (name, stats, isBest) => {
    const card = document.createElement("article");
    card.className = `ab-card ${isBest ? "ab-best" : ""}`.trim();
    card.innerHTML = `
      <h3>Volante ${name}${isBest ? " (melhor custo/chance)" : ""}</h3>
      <p>Composicao: ${stats.distribution.duplos}D/${stats.distribution.triplos}T</p>
      <p>Cobertura: ${formatPercent(stats.coverage)} | Combinacoes: ${stats.combos}</p>
      <p>Custo: ${formatCurrency(stats.combos)}</p>
      <p>Chance: ${stats.inv ? `1 em ${stats.inv.toLocaleString("pt-BR")}` : "1 em -"} (${formatPercent(stats.p14 * 100)})</p>
    `;
    return card;
  };

  root.appendChild(createCard("A", a, best === "A"));
  root.appendChild(createCard("B", b, best === "B"));
  setAbStatus(`Comparacao pronta. Melhor relacao custo/chance: Volante ${best}.`);
}

function formatPercent(value) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sampleOutcome(probabilities) {
  const r = Math.random();
  if (r < probabilities.H) return "H";
  if (r < probabilities.H + probabilities.D) return "D";
  return "A";
}

function runMonteCarlo(ticket, runs = MONTE_CARLO_RUNS) {
  let hits14 = 0;
  let hits13plus = 0;
  let hits12plus = 0;
  for (let i = 0; i < runs; i += 1) {
    let hits = 0;
    for (const game of ticket) {
      const outcome = sampleOutcome(game.probabilities);
      if (game.picks.includes(outcome)) hits += 1;
    }
    if (hits >= 12) hits12plus += 1;
    if (hits >= 13) hits13plus += 1;
    if (hits === 14) hits14 += 1;
  }

  const p = hits14 / runs;
  const stderr = Math.sqrt((p * (1 - p)) / runs);
  const low = Math.max(0, p - 1.96 * stderr);
  const high = Math.min(1, p + 1.96 * stderr);
  return {
    p,
    low,
    high,
    hits14,
    runs,
    p12plus: hits12plus / runs,
    p13plus: hits13plus / runs
  };
}

function setBudgetStatus(message, isError = false) {
  const el = document.getElementById("budget-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function chooseBestCompositionForBudget(maxBudget) {
  if (!Number.isFinite(maxBudget) || maxBudget < 1) return null;
  const secas = pickSecas(games);
  const candidates = compositions.filter((c) => c.cost <= maxBudget);
  if (candidates.length === 0) return null;

  let best = null;
  candidates.forEach((comp) => {
    const ticket = applyComposition(games, secas, comp);
    const stats = computeTicketStats(ticket);
    const score = stats.p14 + stats.coverage / 1000 - stats.combos / 100000;
    if (!best || score > best.score) {
      best = { comp, stats, score };
    }
  });

  return best;
}

function renderGames(ticket) {
  const root = document.getElementById("games-grid");
  root.innerHTML = "";

  ticket.forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";

    const title = document.createElement("h3");
    title.className = "game-title";
    title.textContent = `Jogo ${game.id}: ${game.home} x ${game.away}`;

    const probs = document.createElement("p");
    probs.className = "prob-line";
    probs.textContent =
      `Casa: ${(game.probabilities.H * 100).toFixed(0)}% | ` +
      `Fora: ${(game.probabilities.A * 100).toFixed(0)}% | ` +
      `Empate: ${(game.probabilities.D * 100).toFixed(0)}%`;

    const row = document.createElement("div");
    row.className = "pick-row";

    ["H", "D", "A"].forEach((symbol) => {
      const chip = document.createElement("button");
      const isSelected = game.picks.includes(symbol);
      chip.className = `pick-chip ${isSelected ? "active" : ""}`.trim();
      chip.textContent = outcomeLabel[symbol];
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(isSelected));
      chip.addEventListener("click", () => togglePick(game.id, symbol));
      row.appendChild(chip);
    });

    card.append(title, probs, row);
    root.appendChild(card);
  });
}

function renderSuggestions(secas) {
  const names = secas.map((g) => (g.best === "H" ? g.home : g.best === "A" ? g.away : "Empate"));
  document.getElementById("secas-list").textContent = `Sugestoes de secas: ${names.join(", ")}`;
}

function renderCompositions() {
  const root = document.getElementById("compositions-list");
  root.innerHTML = "";

  compositions.forEach((comp) => {
    const btn = document.createElement("button");
    btn.className = `composition-btn ${selectedComposition.name === comp.name ? "active" : ""}`.trim();
    btn.type = "button";
    btn.innerHTML =
      `${comp.name}: ${comp.duplos} duplos, ${comp.triplos} triplos (${formatCurrency(comp.cost)}) ` +
      `${comp.recommended ? '<span class="tag-recommended">★ RECOMENDADO</span>' : ""}`;
    btn.addEventListener("click", () => {
      selectedComposition = comp;
      refreshView();
    });
    root.appendChild(btn);
  });
}

function detectPresetByDistribution(distribution) {
  const found = Object.entries(RISK_PRESETS).find(
    ([, preset]) => preset.duplos === distribution.duplos && preset.triplos === distribution.triplos
  );
  return found ? found[0] : "custom";
}

function syncRiskPresetControl() {
  const select = document.getElementById("risk-preset");
  if (select) select.value = selectedRiskPreset;
}

function renderStrategyCompare(currentTicket) {
  const root = document.getElementById("strategy-compare");
  if (!root) return;

  const secas = pickSecas(games);
  const suggested = compositions.map((comp) => {
    const ticket = applyComposition(games, secas, comp);
    return { name: comp.name, ticket, selected: selectedComposition && selectedComposition.name === comp.name };
  });

  const manualEntry = { name: "Manual atual", ticket: currentTicket, selected: true, manual: true };
  const allEntries = [...suggested, manualEntry];

  root.innerHTML = "";
  allEntries.forEach((entry) => {
    const stats = computeTicketStats(entry.ticket);
    const card = document.createElement("article");
    card.className = `strategy-card ${entry.selected ? "is-selected" : ""} ${entry.manual ? "is-manual" : ""}`.trim();
    card.innerHTML = `
      <h3>${entry.name}${entry.selected && !entry.manual ? " (selecionada)" : ""}</h3>
      <p>Composicao: ${stats.distribution.duplos}D/${stats.distribution.triplos}T</p>
      <p>Cobertura: ${formatPercent(stats.coverage)} | Comb.: ${stats.combos}</p>
      <p>Custo: ${formatCurrency(stats.combos)}</p>
      <p>Chance: ${stats.inv ? `1 em ${stats.inv.toLocaleString("pt-BR")}` : "1 em -"} (${formatPercent(stats.p14 * 100)})</p>
    `;
    root.appendChild(card);
  });
}

function renderTicketHistory() {
  const root = document.getElementById("ticket-history");
  if (!root) return;
  const history = loadHistory();
  root.innerHTML = "";

  if (history.length === 0) {
    root.innerHTML = "<p>Nenhum volante salvo ainda.</p>";
    return;
  }

  history.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-item";
    card.innerHTML = `
      <p><strong>${item.label}</strong></p>
      <p>${item.timestamp}</p>
      <p>Composicao: ${item.distribution}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary-btn";
    btn.textContent = "Reaplicar";
    btn.addEventListener("click", () => applyHistoryItem(item.id));
    card.appendChild(btn);
    root.appendChild(card);
  });
}

function updateResult(ticket) {
  const { p14, inv, distribution, combos, coverage } = computeTicketStats(ticket);
  const mc = runMonteCarlo(ticket);

  document.getElementById("coverage-value").textContent = formatPercent(coverage);
  document.getElementById("coverage-combos").textContent = `${combos} combinacoes cobertas`;
  document.getElementById("chance-value").textContent = inv ? `1 em ${inv.toLocaleString("pt-BR")}` : "1 em -";
  document.getElementById("chance-percent").textContent = formatPercent(p14 * 100);
  document.getElementById("cost-value").textContent = formatCurrency(combos);
  document.getElementById("composition-badge").textContent =
    `Composicao atual: ${distribution.duplos} duplos e ${distribution.triplos} triplos (${selectedRiskPreset})`;

  const warning = document.getElementById("limit-warning");
  const outOfRange = distribution.duplos < 2 || distribution.duplos > 6 || distribution.triplos < 0 || distribution.triplos > 2;
  if (outOfRange) {
    warning.hidden = false;
    warning.textContent = "A composicao manual saiu da faixa recomendada (duplos 2-6 e triplos 0-2).";
  } else {
    warning.hidden = true;
    warning.textContent = "";
  }

  document.getElementById("mc-hit-rate").textContent = formatPercent(mc.p * 100);
  document.getElementById("mc-interval").textContent =
    `IC 95%: ${formatPercent(mc.low * 100)} - ${formatPercent(mc.high * 100)} (${mc.hits14}/${mc.runs})`;
  document.getElementById("mc-bands").textContent =
    `Faixas: 12+ ${formatPercent(mc.p12plus * 100)} | 13+ ${formatPercent(mc.p13plus * 100)} | 14 ${formatPercent(mc.p * 100)}`;

  renderStrategyCompare(ticket);
  renderTicketHistory();
}

function buildTicketText(ticket) {
  const distribution = getDistribution(ticket);
  const combos = distribution.duplos > 0 || distribution.triplos > 0
    ? 2 ** distribution.duplos * 3 ** distribution.triplos
    : 1;
  const coverage = ((distribution.duplos + distribution.triplos * 2) / 14) * 100;
  const header = [
    "LOTERIA ESPORTIVA INTELIGENTE - VOLANTE SUGERIDO",
    `Composicao: ${distribution.duplos}D/${distribution.triplos}T`,
    `Cobertura: ${formatPercent(coverage)} | Combinacoes: ${combos}`,
    `Custo estimado: ${formatCurrency(combos)}`,
    ""
  ];

  const lines = ticket.map((g) => {
    const picks = g.picks.map((p) => outcomeLabel[p]).join("/");
    return `Jogo ${g.id.toString().padStart(2, "0")} - ${g.home} x ${g.away}: ${picks}`;
  });
  return [...header, ...lines].join("\n");
}

function exportTicketPng(ticket) {
  const text = buildTicketText(ticket);
  const lines = text.split("\n");
  const width = 1200;
  const lineHeight = 34;
  const padding = 48;
  const headerHeight = 88;
  const height = headerHeight + padding + lines.length * lineHeight + 24;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f766e";
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText("Loteria Esportiva Inteligente - Volante", 40, 54);

  ctx.fillStyle = "#0f172a";
  ctx.font = "24px Consolas, monospace";
  lines.forEach((line, idx) => {
    ctx.fillText(line || " ", padding, headerHeight + padding + idx * lineHeight);
  });

  const url = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "volante-loesin.png";
  anchor.click();
}

function refreshView() {
  const secas = pickSecas(games);
  appliedPicks = applyComposition(games, secas, selectedComposition);
  renderGames(appliedPicks);
  renderSuggestions(secas);
  renderCompositions();
  updateResult(appliedPicks);
  selectedRiskPreset = detectPresetByDistribution(getDistribution(appliedPicks));
  syncRiskPresetControl();
  saveState();
}

function getDistribution(ticket) {
  return ticket.reduce(
    (acc, g) => {
      if (g.picks.length === 2) acc.duplos += 1;
      if (g.picks.length === 3) acc.triplos += 1;
      return acc;
    },
    { duplos: 0, triplos: 0 }
  );
}

function togglePick(gameId, symbol) {
  const game = appliedPicks.find((g) => g.id === gameId);
  if (!game) return;

  if (game.picks.includes(symbol)) {
    if (game.picks.length === 1) return;
    game.picks = game.picks.filter((p) => p !== symbol);
  } else {
    game.picks = [...game.picks, symbol].sort((a, b) => ["H", "D", "A"].indexOf(a) - ["H", "D", "A"].indexOf(b));
  }

  renderGames(appliedPicks);
  selectedRiskPreset = "custom";
  syncRiskPresetControl();
  updateResult(appliedPicks);
  saveState();
}

function applyRiskPreset(presetKey) {
  if (!RISK_PRESETS[presetKey]) return;
  const target = RISK_PRESETS[presetKey];
  selectedComposition =
    compositions.find((c) => c.duplos === target.duplos && c.triplos === target.triplos) || selectedComposition;
  selectedRiskPreset = presetKey;
  refreshView();
}

function captureHistory(label = "Volante salvo") {
  const history = loadHistory();
  const distribution = getDistribution(appliedPicks);
  const snapshot = {
    id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    label,
    timestamp: new Date().toLocaleString("pt-BR"),
    distribution: `${distribution.duplos}D/${distribution.triplos}T`,
    selectedRiskPreset,
    selectedComposition: selectedComposition ? selectedComposition.name : null,
    picks: appliedPicks.map((g) => ({ id: g.id, picks: g.picks }))
  };
  const next = [snapshot, ...history];
  saveHistory(next);
  renderTicketHistory();
}

function captureHistoryFromSnapshot(snapshot, label = "Volante importado") {
  const history = loadHistory();
  const distribution = snapshot.distribution || "0D/0T";
  const snapshotItem = {
    id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    label,
    timestamp: new Date().toLocaleString("pt-BR"),
    distribution,
    selectedRiskPreset: snapshot.selectedRiskPreset || "custom",
    selectedComposition: snapshot.selectedComposition || null,
    picks: snapshot.picks
  };
  saveHistory([snapshotItem, ...history]);
  renderTicketHistory();
}

function applyHistoryItem(id) {
  const history = loadHistory();
  const item = history.find((entry) => entry.id === id);
  if (!item) return;

  const savedComp = compositions.find((c) => c.name === item.selectedComposition);
  if (savedComp) selectedComposition = savedComp;
  selectedRiskPreset = item.selectedRiskPreset || "custom";
  appliedPicks = applyComposition(games, pickSecas(games), selectedComposition);
  const savedPicks = Array.isArray(item.picks) ? item.picks : [];
  savedPicks.forEach((saved) => {
    const match = appliedPicks.find((g) => g.id === saved.id);
    const picks = normalizeManualPicks(saved.picks);
    if (match && picks.length > 0) match.picks = picks;
  });

  renderGames(appliedPicks);
  renderSuggestions(pickSecas(games));
  renderCompositions();
  updateResult(appliedPicks);
  syncRiskPresetControl();
  saveState();
}

function applyPortableSnapshot(snapshot) {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    setImportStatus(validation.reason, true);
    return false;
  }

  const savedComp = compositions.find((c) => c.name === snapshot.selectedComposition);
  if (savedComp) selectedComposition = savedComp;
  selectedRiskPreset = typeof snapshot.selectedRiskPreset === "string" ? snapshot.selectedRiskPreset : "custom";
  appliedPicks = applyComposition(games, pickSecas(games), selectedComposition);

  snapshot.picks.forEach((saved) => {
    const match = appliedPicks.find((g) => g.id === saved.id);
    const picks = normalizeManualPicks(saved.picks);
    if (match && picks.length > 0) match.picks = picks;
  });

  renderGames(appliedPicks);
  renderSuggestions(pickSecas(games));
  renderCompositions();
  updateResult(appliedPicks);
  syncRiskPresetControl();
  saveState();
  captureHistoryFromSnapshot(snapshot, "Volante importado em JSON");
  setImportStatus("Volante JSON importado com sucesso.");
  return true;
}

function setupActions() {
  const confirm = document.getElementById("confirm-build");
  const generateBtn = document.getElementById("generate-btn");
  const exportPngBtn = document.getElementById("export-png-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const copyJsonBtn = document.getElementById("copy-json-btn");
  const importJsonInput = document.getElementById("import-json-input");
  const output = document.getElementById("ticket-output");
  const applyBalancedBtn = document.getElementById("apply-balanced-btn");
  const riskPreset = document.getElementById("risk-preset");
  const abJsonAInput = document.getElementById("ab-json-a");
  const abJsonBInput = document.getElementById("ab-json-b");
  const budgetInput = document.getElementById("budget-input");
  const optimizeBudgetBtn = document.getElementById("optimize-budget-btn");
  const roundDataInput = document.getElementById("round-data-input");
  const resetRoundBtn = document.getElementById("reset-round-btn");
  const contestNumberInput = document.getElementById("contest-number-input");
  const contestDateInput = document.getElementById("contest-date-input");
  const contestResultInput = document.getElementById("contest-result-input");
  const saveContestBtn = document.getElementById("save-contest-btn");
  const loadContestBtn = document.getElementById("load-contest-btn");
  const checkResultBtn = document.getElementById("check-result-btn");

  confirm.addEventListener("change", () => {
    const canGenerate = confirm.checked;
    generateBtn.disabled = !canGenerate;
    exportPngBtn.disabled = !canGenerate;
    exportJsonBtn.disabled = !canGenerate;
    copyJsonBtn.disabled = !canGenerate;
    saveState();
  });

  generateBtn.addEventListener("click", () => {
    const text = buildTicketText(appliedPicks);
    output.value = text;
    captureHistory("Volante exportado em TXT");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "volante-loesin.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  exportPngBtn.addEventListener("click", () => {
    const text = buildTicketText(appliedPicks);
    output.value = text;
    exportTicketPng(appliedPicks);
    captureHistory("Volante exportado em PNG");
  });

  exportJsonBtn.addEventListener("click", () => {
    const snapshot = createPortableSnapshot("Volante exportado em JSON");
    const text = JSON.stringify(snapshot, null, 2);
    output.value = text;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "volante-loesin.json";
    anchor.click();
    URL.revokeObjectURL(url);
    captureHistory("Volante exportado em JSON");
    setImportStatus("JSON exportado com sucesso.");
  });

  copyJsonBtn.addEventListener("click", async () => {
    try {
      const snapshot = createPortableSnapshot("Volante copiado em JSON");
      const text = JSON.stringify(snapshot, null, 2);
      await navigator.clipboard.writeText(text);
      output.value = text;
      setImportStatus("JSON copiado para a area de transferencia.");
    } catch (_error) {
      setImportStatus("Nao foi possivel copiar JSON neste navegador.", true);
    }
  });

  importJsonInput.addEventListener("change", async () => {
    const file = importJsonInput.files && importJsonInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      output.value = text;
      applyPortableSnapshot(parsed);
    } catch (_error) {
      setImportStatus("Falha ao ler JSON. Verifique o arquivo.", true);
    } finally {
      importJsonInput.value = "";
    }
  });

  applyBalancedBtn.addEventListener("click", () => {
    selectedComposition = compositions.find((c) => c.name === "Equilibrada") || selectedComposition;
    selectedRiskPreset = "medio";
    refreshView();
  });

  riskPreset.addEventListener("change", () => {
    const selected = riskPreset.value;
    if (selected === "custom") {
      selectedRiskPreset = "custom";
      syncRiskPresetControl();
      saveState();
      return;
    }
    applyRiskPreset(selected);
  });

  abJsonAInput.addEventListener("change", async () => {
    const file = abJsonAInput.files && abJsonAInput.files[0];
    if (!file) return;
    try {
      abSnapshotA = JSON.parse(await file.text());
      setAbStatus("JSON A carregado.");
      renderABCompare();
    } catch (_error) {
      setAbStatus("Falha ao carregar JSON A.", true);
    } finally {
      abJsonAInput.value = "";
    }
  });

  abJsonBInput.addEventListener("change", async () => {
    const file = abJsonBInput.files && abJsonBInput.files[0];
    if (!file) return;
    try {
      abSnapshotB = JSON.parse(await file.text());
      setAbStatus("JSON B carregado.");
      renderABCompare();
    } catch (_error) {
      setAbStatus("Falha ao carregar JSON B.", true);
    } finally {
      abJsonBInput.value = "";
    }
  });

  optimizeBudgetBtn.addEventListener("click", () => {
    const budget = Number(budgetInput.value);
    const result = chooseBestCompositionForBudget(budget);
    if (!result) {
      setBudgetStatus("Nao foi encontrada composicao valida para esse orcamento.", true);
      return;
    }

    selectedComposition = result.comp;
    selectedRiskPreset = detectPresetByDistribution({ duplos: result.comp.duplos, triplos: result.comp.triplos });
    refreshView();
    setBudgetStatus(
      `Melhor composicao ate ${formatCurrency(budget)}: ${result.comp.name} (${result.comp.duplos}D/${result.comp.triplos}T, custo ${formatCurrency(result.comp.cost)}).`
    );
  });

  roundDataInput.addEventListener("change", async () => {
    const file = roundDataInput.files && roundDataInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = file.name.toLowerCase().endsWith(".csv") ? { games: parseRoundCsv(text) } : extractRoundPayload(JSON.parse(text));
      const validation = validateRoundGames(payload.games);
      if (!validation.ok) {
        setRoundStatus(validation.reason, true);
        appendLog(validation.reason, "warn");
        return;
      }
      currentContestNumber = payload.contestNumber || "";
      currentContestDate = payload.contestDate || "";
      localStorage.setItem(
        ROUND_DATA_KEY,
        JSON.stringify({ contestNumber: currentContestNumber, contestDate: currentContestDate, games: payload.games })
      );
      reinitializeRound(payload.games);
      setRoundBadge("official");
      setRoundStatus("Rodada importada com sucesso.");
      appendLog(`Rodada importada (${file.name}).`);
    } catch (error) {
      setRoundStatus("Falha ao importar rodada. Use JSON/CSV valido.", true);
      appendLog(`Erro importando rodada: ${error.message}`, "error");
    } finally {
      roundDataInput.value = "";
    }
  });

  resetRoundBtn.addEventListener("click", () => {
    localStorage.removeItem(ROUND_DATA_KEY);
    currentContestNumber = "";
    currentContestDate = "";
    reinitializeRound(fallbackGames);
    setRoundBadge("mock");
    setRoundStatus("Dados mock restaurados.");
    appendLog("Rodada resetada para mock.");
  });

  contestDateInput.addEventListener("input", () => {
    currentContestDate = contestDateInput.value.trim();
    refreshContestMetaDisplay();
  });

  saveContestBtn.addEventListener("click", () => {
    const contest = Number(contestNumberInput.value);
    if (!Number.isInteger(contest) || contest <= 0) {
      setContestStatus("Informe um numero de concurso valido.", true);
      return;
    }
    currentContestNumber = String(contest);
    currentContestDate = contestDateInput.value.trim();
    refreshContestMetaDisplay();
    saveCurrentContestSnapshot(contest);
    setContestStatus(`Volante salvo na memoria para o concurso ${contest}.`);
  });

  loadContestBtn.addEventListener("click", () => {
    const contest = Number(contestNumberInput.value);
    if (!Number.isInteger(contest) || contest <= 0) {
      setContestStatus("Informe um numero de concurso valido.", true);
      return;
    }
    const snapshot = getContestSnapshot(contest);
    if (!snapshot) {
      setContestStatus(`Nao existe volante salvo para o concurso ${contest}.`, true);
      return;
    }
    currentContestNumber = String(contest);
    currentContestDate = String(snapshot.contestDate || "");
    refreshContestMetaDisplay();
    const ok = applyPortableSnapshot(snapshot);
    if (ok) setContestStatus(`Volante do concurso ${contest} carregado com sucesso.`);
  });

  checkResultBtn.addEventListener("click", () => {
    const contest = Number(contestNumberInput.value);
    const parsedResult = parseOfficialResult(contestResultInput.value);
    if (!parsedResult) {
      setContestStatus("Resultado invalido. Informe 14 simbolos (H/D/A ou 1/X/2).", true);
      return;
    }

    const currentHits = countHitsForTicket(appliedPicks, parsedResult);
    const snapshot = Number.isInteger(contest) && contest > 0 ? getContestSnapshot(contest) : null;
    if (!snapshot) {
      setContestStatus(`Conferencia atual: ${currentHits}/14 acertos no volante em tela.`);
      return;
    }
    const savedTicket = ticketFromSnapshot(snapshot);
    if (!savedTicket) {
      setContestStatus("Volante salvo esta invalido e nao pode ser comparado.", true);
      return;
    }
    const savedHits = countHitsForTicket(savedTicket, parsedResult);
    const diff = currentHits - savedHits;
    const deltaText = diff === 0 ? "empatou com o salvo" : diff > 0 ? `${diff} acerto(s) a mais` : `${Math.abs(diff)} acerto(s) a menos`;
    setContestStatus(`Concurso ${contest}: atual ${currentHits}/14, salvo ${savedHits}/14 (${deltaText}).`);
  });
}

async function bootstrap() {
  const importedRoundRaw = localStorage.getItem(ROUND_DATA_KEY);
  let importedRound = null;
  try {
    importedRound = importedRoundRaw ? JSON.parse(importedRoundRaw) : null;
  } catch (_error) {
    importedRound = null;
    localStorage.removeItem(ROUND_DATA_KEY);
  }
  let packagedContest = null;
  try {
    const packagedResponse = await fetch("./data/concurso-1242.json");
    if (packagedResponse.ok) {
      packagedContest = await packagedResponse.json();
    }
  } catch (_error) {
    packagedContest = null;
  }

  const sourcePayload = importedRound
    ? extractRoundPayload(importedRound)
    : packagedContest
      ? extractRoundPayload(packagedContest)
      : { games: await loadGames(), contestNumber: "", contestDate: "" };
  const roundValidation = validateRoundGames(sourcePayload.games);
  const initialGames = roundValidation.ok ? sourcePayload.games : fallbackGames;
  currentContestNumber = sourcePayload.contestNumber || "";
  currentContestDate = sourcePayload.contestDate || "";
  games = buildAnalysis(initialGames).slice(0, 14);
  compositions = buildCompositions();
  selectedComposition = compositions.find((c) => c.recommended) || compositions[1] || compositions[0];
  const state = loadState();
  if (state) {
    const savedComp = compositions.find((c) => c.name === state.selectedComposition);
    if (savedComp) selectedComposition = savedComp;
    if (typeof state.selectedRiskPreset === "string") selectedRiskPreset = state.selectedRiskPreset;
    appliedPicks = applyComposition(games, pickSecas(games), selectedComposition);
    const savedPicks = Array.isArray(state.picks) ? state.picks : [];
    savedPicks.forEach((saved) => {
      const match = appliedPicks.find((g) => g.id === saved.id);
      const picks = normalizeManualPicks(saved.picks);
      if (match && picks.length > 0) match.picks = picks;
    });
  } else {
    appliedPicks = applyComposition(games, pickSecas(games), selectedComposition);
  }
  renderGames(appliedPicks);
  renderSuggestions(pickSecas(games));
  renderCompositions();
  updateResult(appliedPicks);
  syncRiskPresetControl();
  refreshContestMetaDisplay();
  saveState();
  setupActions();
  renderErrorLogs();
  if ((importedRound || packagedContest) && roundValidation.ok) {
    setRoundBadge("official");
    if (importedRound) {
      setRoundStatus("Rodada personalizada carregada do armazenamento local.");
    } else {
      setRoundStatus("Concurso 1242 carregado automaticamente.");
    }
  } else {
    setRoundBadge("mock");
  }
}

window.addEventListener("error", (event) => {
  appendLog(event.message || "Erro inesperado de runtime.", "error");
});
window.addEventListener("unhandledrejection", (event) => {
  appendLog(`Promise rejeitada: ${event.reason}`, "error");
});

bootstrap();
