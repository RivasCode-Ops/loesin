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
let currentBettingPeriod = "";
let currentGamesPeriod = "";
let analysisBudget = 100;
let disagreementGameIds = new Set();
let wizardStepIndex = null;
let wizardManualSymbols = ["H"];
let volanteVisited = new Set();
let volanteModalGameId = null;
let volanteModalPicks = [];
const STORAGE_KEY = "loesin_ticket_v12";
const HISTORY_KEY = "loesin_history_v1";
const ROUND_DATA_KEY = "loesin_round_data_v1";
const LOG_KEY = "loesin_error_log_v1";
const CONTEST_MEMORY_KEY = "loesin_contest_memory_v1";
const MONTE_CARLO_RUNS = 10000;
const RISK_PRESETS = {
  baixo: { duplos: 3, triplos: 0, label: "Baixo risco" },
  medio: { duplos: 4, triplos: 1, label: "Medio risco" },
  alto: { duplos: 4, triplos: 2, label: "Alto risco" }
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
    const hasMeta = currentContestNumber || currentContestDate;
    badge.textContent = hasMeta
      ? `Status da rodada: Concurso ${currentContestNumber || "-"} - ${currentContestDate || "-"}`
      : "Status da rodada: IMPORTADA (concurso atual)";
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
    const contestNum = currentContestNumber || "-";
    const dateLabel = currentContestDate || "-";
    const previousNumber = /^\d+$/.test(String(currentContestNumber))
      ? String(Math.max(1, Number(currentContestNumber) - 1))
      : "";
    const previousText = previousNumber ? ` | Anterior: ${previousNumber}` : "";
    meta.textContent = `Concurso: ${contestNum} | Data: ${dateLabel}${previousText}`;
  }
}

async function loadPackagedContest() {
  const candidates = [
    "./data/concurso-1242.json",
    "data/concurso-1242.json",
    "/loesin/data/concurso-1242.json"
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return await response.json();
      }
    } catch (_error) {
      // tenta proximo caminho
    }
  }
  return null;
}

function extractRoundPayload(input) {
  if (Array.isArray(input)) return { games: input, contestNumber: "", contestDate: "" };
  if (input && typeof input === "object" && Array.isArray(input.games)) {
    return {
      games: input.games,
      contestNumber: String(input.contestNumber || ""),
      contestDate: String(input.contestDate || ""),
      bettingPeriod: String(input.bettingPeriod || ""),
      gamesPeriod: String(input.gamesPeriod || "")
    };
  }
  return { games: null, contestNumber: "", contestDate: "", bettingPeriod: "", gamesPeriod: "" };
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
  resetGameWizard();
  volanteVisited = new Set();
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
      confidenceMargin: ordered[0][1] - ordered[1][1],
      gameDate: game.gameDate || ""
    };
  });
}

function renderRoundOfficialInfo() {
  const box = document.getElementById("round-official-info");
  if (!box) return;
  const hasAny = currentContestNumber || currentContestDate || currentBettingPeriod || currentGamesPeriod;
  if (!hasAny) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <p><strong>Concurso ${currentContestNumber || "-"}</strong> (${currentContestDate || "-"})</p>
    <p>Periodo de apostas: ${currentBettingPeriod || "-"}</p>
    <p>Realizacao dos jogos: ${currentGamesPeriod || "-"}</p>
  `;
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

function enumerateBudgetCompositions() {
  const list = [];
  for (let d = 2; d <= 6; d += 1) {
    for (let t = 0; t <= 2; t += 1) {
      if (d + t > 6) continue;
      list.push(compositionMetrics(d, t));
    }
  }
  return list;
}

function wrapMetricsAsComposition(m) {
  const existing = compositions.find((c) => c.duplos === m.duplos && c.triplos === m.triplos);
  if (existing) return existing;
  return {
    name: `Orcamento (${m.duplos}D/${m.triplos}T)`,
    ...m,
    strategy: "orcamento"
  };
}

function formatCompositionHumanPT(duplos, triplos) {
  const parts = [];
  if (triplos > 0) parts.push(`${triplos} ${triplos === 1 ? "triplo" : "triplos"}`);
  if (duplos > 0) parts.push(`${duplos} ${duplos === 1 ? "duplo" : "duplos"}`);
  return parts.length ? parts.join(" e ") : "apenas secas (sem duplo/triplo extra)";
}

function buildCompositions() {
  const all = [];
  for (let d = 2; d <= 6; d += 1) {
    for (let t = 0; t <= 2; t += 1) {
      if (d + t > 6) continue;
      all.push(compositionMetrics(d, t));
    }
  }
  const pickByProfile = (targetDuplos, targetTriplos) =>
    all.find((c) => c.duplos === targetDuplos && c.triplos === targetTriplos) ||
    compositionMetrics(targetDuplos, targetTriplos);

  // Perfis padrao de custo/cobertura para manter coerencia da experiencia.
  const conservative = pickByProfile(3, 0);
  const balanced = pickByProfile(4, 1);
  const aggressive = pickByProfile(4, 2);

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
    picks: appliedPicks.map((g) => ({ id: g.id, picks: g.picks })),
    volanteVisited: [...volanteVisited]
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

/** Aplica JSON da API da Caixa ao campo de resultado e metadados opcionais. */
async function applyCaixaApiPayload(payload, options = {}) {
  const { formatOfficialResultInput, resultSymbolsFromCaixaPayload } = await import("./lib/caixa-loteca.mjs");
  const parsed = resultSymbolsFromCaixaPayload(payload);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }
  const contestResultInput = document.getElementById("contest-result-input");
  const contestNumberInput = document.getElementById("contest-number-input");
  const contestDateInput = document.getElementById("contest-date-input");
  if (contestResultInput) {
    contestResultInput.value = formatOfficialResultInput(parsed.symbols);
  }
  if (options.syncMeta !== false) {
    if (parsed.numero != null && contestNumberInput) {
      contestNumberInput.value = String(parsed.numero);
      currentContestNumber = String(parsed.numero);
    }
    if (parsed.dataApuracao && contestDateInput) {
      contestDateInput.value = parsed.dataApuracao;
      currentContestDate = parsed.dataApuracao;
    }
    refreshContestMetaDisplay();
  }
  return {
    ok: true,
    numero: parsed.numero,
    dataApuracao: parsed.dataApuracao
  };
}

function performContestResultCheck() {
  const contestNumberInput = document.getElementById("contest-number-input");
  const contestResultInput = document.getElementById("contest-result-input");
  if (!contestNumberInput || !contestResultInput) return;

  const contest = Number(contestNumberInput.value);
  const parsedResult = parseOfficialResult(contestResultInput.value);
  if (!parsedResult) {
    hideOfficialAnalysis();
    setContestStatus("Resultado invalido. Informe 14 simbolos (H/D/A ou 1/X/2).", true);
    return;
  }

  const currentHits = countHitsForTicket(appliedPicks, parsedResult);
  renderOfficialVsTicketAnalysis(parsedResult, appliedPicks);

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
}

function countHitsForTicket(ticket, resultSymbols) {
  let hits = 0;
  for (let i = 0; i < 14; i += 1) {
    if (ticket[i] && ticket[i].picks.includes(resultSymbols[i])) hits += 1;
  }
  return hits;
}

let lastOfficialAnalysisCsv = "";

function classifyTicketRowType(gameId, picksLength) {
  const secaIds = new Set(pickSecas(games).map((s) => s.id));
  if (picksLength === 3) return "Triplo";
  if (picksLength === 2) return "Duplo";
  if (picksLength === 1 && secaIds.has(gameId)) return "Seca";
  if (picksLength === 1) return "Simples";
  return "-";
}

function hideOfficialAnalysis() {
  const wrap = document.getElementById("official-analysis-wrap");
  if (wrap) wrap.hidden = true;
  lastOfficialAnalysisCsv = "";
}

function csvEscapeCell(value) {
  const t = String(value);
  if (/[;"\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function renderOfficialVsTicketAnalysis(resultSymbols, ticket) {
  const wrap = document.getElementById("official-analysis-wrap");
  const tbody = document.getElementById("official-analysis-tbody");
  const summary = document.getElementById("official-analysis-summary");
  const extra = document.getElementById("official-analysis-extra");
  if (!wrap || !tbody || !summary || !extra) return;

  const rows = [];
  let hits = 0;
  let favHits = 0;
  const dist = { H: 0, D: 0, A: 0 };
  for (const s of resultSymbols) {
    if (Object.prototype.hasOwnProperty.call(dist, s)) dist[s] += 1;
  }

  for (let i = 0; i < 14; i += 1) {
    const g = ticket[i];
    if (!g) continue;
    const sym = resultSymbols[i];
    const hit = g.picks.includes(sym);
    if (hit) hits += 1;
    if (g.best === sym) favHits += 1;
    const tipo = classifyTicketRowType(g.id, g.picks.length);
    const picksStr = g.picks.map((p) => outcomeLabel[p] || p).join(" + ");
    const oficialStr = `${sym} (${outcomeLabel[sym] || sym})`;
    rows.push({
      id: g.id,
      jogo: `${g.home} x ${g.away}`,
      tipo,
      palpites: picksStr,
      oficial: oficialStr,
      hit
    });
  }

  tbody.replaceChildren();
  for (const r of rows) {
    const tr = document.createElement("tr");
    [String(r.id), r.jogo, r.tipo, r.palpites, r.oficial].forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdHit = document.createElement("td");
    tdHit.textContent = r.hit ? "Sim" : "Nao";
    tdHit.className = r.hit ? "hit-yes" : "hit-no";
    tr.appendChild(tdHit);
    tbody.appendChild(tr);
  }

  const by = (t) => rows.filter((row) => row.tipo === t);
  const hitCount = (list) => list.filter((row) => row.hit).length;
  const secaRows = by("Seca");
  const duploRows = by("Duplo");
  const triploRows = by("Triplo");
  const simplesRows = by("Simples");

  summary.innerHTML = `Total no volante: <strong>${hits}/14</strong> jogos cobertos pelo resultado oficial. Benchmark so o favorito do modelo: <strong>${favHits}/14</strong>. Distribuicao do resultado: Casa ${dist.H}, Empate ${dist.D}, Fora ${dist.A}.`;

  extra.textContent =
    `Por tipo de linha — Secas: ${hitCount(secaRows)}/${secaRows.length}, Duplos: ${hitCount(duploRows)}/${duploRows.length}, ` +
    `Triplos: ${hitCount(triploRows)}/${triploRows.length}, Simples: ${hitCount(simplesRows)}/${simplesRows.length}.`;

  const lines = [
    ["jogo", "mandante", "visitante", "tipo", "palpites_csv", "oficial", "acerto_volante", "favorito_modelo_acertou"].join(";")
  ];
  for (let i = 0; i < 14; i += 1) {
    const g = ticket[i];
    const sym = resultSymbols[i];
    const hit = g.picks.includes(sym);
    const tipo = classifyTicketRowType(g.id, g.picks.length);
    lines.push(
      [
        String(g.id),
        csvEscapeCell(g.home),
        csvEscapeCell(g.away),
        csvEscapeCell(tipo),
        csvEscapeCell(g.picks.join(",")),
        sym,
        hit ? "sim" : "nao",
        g.best === sym ? "sim" : "nao"
      ].join(";")
    );
  }
  lastOfficialAnalysisCsv = `\ufeff${lines.join("\n")}`;
  wrap.hidden = false;
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

function setAnalysisBudgetStatus(message, isError = false) {
  const el = document.getElementById("analysis-budget-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#334155";
}

function classifyGameRecommendation(game) {
  const ordered = orderOutcomes(game.probabilities);
  const bestProb = ordered[0][1];
  const secondProb = ordered[1][1];
  const margin = bestProb - secondProb;
  if (bestProb >= 0.6 && margin >= 0.18) return { mode: "simples", picks: [ordered[0][0]], margin, bestProb };
  if (bestProb >= 0.45 && margin >= 0.08) return { mode: "duplo", picks: [ordered[0][0], ordered[1][0]], margin, bestProb };
  return { mode: "triplo", picks: ["H", "D", "A"], margin, bestProb };
}

function getRecommendedPicksForGame(game, mode) {
  const ordered = orderOutcomes(game.probabilities);
  if (mode === "simples") return [ordered[0][0]];
  if (mode === "duplo") return [ordered[0][0], ordered[1][0]];
  return ["H", "D", "A"];
}

function allocateBudgetByGame(ticket, totalBudget) {
  const validBudget = Number.isFinite(totalBudget) && totalBudget > 0 ? totalBudget : 0;
  if (!validBudget) return new Map();
  const weights = ticket.map((game) => {
    const rec = classifyGameRecommendation(game);
    const uncertainty = 1 - rec.margin;
    const modeWeight = rec.mode === "simples" ? 1 : rec.mode === "duplo" ? 1.7 : 2.4;
    return { id: game.id, weight: Math.max(0.2, modeWeight * uncertainty) };
  });
  const totalWeight = weights.reduce((acc, item) => acc + item.weight, 0) || 1;
  const amounts = new Map();
  weights.forEach((item) => {
    amounts.set(item.id, (item.weight / totalWeight) * validBudget);
  });
  return amounts;
}

function setGamePicksByMode(gameId, mode) {
  const game = appliedPicks.find((g) => g.id === gameId);
  if (!game) return;
  game.picks = getRecommendedPicksForGame(game, mode);
  selectedRiskPreset = "custom";
  syncRiskPresetControl();
  renderGames(appliedPicks);
  updateResult(appliedPicks);
  saveState();
}

function renderGameInsights(ticket) {
  const root = document.getElementById("game-insights");
  if (!root) return;
  const budgetMap = allocateBudgetByGame(ticket, analysisBudget);
  const bestForBudget = chooseBestCompositionForBudget(analysisBudget);
  root.innerHTML = "";

  const summary = document.createElement("p");
  summary.className = "insight-meta";
  if (bestForBudget) {
    summary.textContent =
      `Para ${formatCurrency(analysisBudget)}, composicao sugerida: ${bestForBudget.comp.name} ` +
      `(${bestForBudget.comp.duplos}D/${bestForBudget.comp.triplos}T, custo ${formatCurrency(bestForBudget.comp.cost)}).`;
  } else {
    summary.textContent = "Orcamento abaixo do minimo para compor combinacoes sugeridas.";
  }
  root.appendChild(summary);

  ticket.forEach((game) => {
    const rec = classifyGameRecommendation(game);
    const item = document.createElement("article");
    item.className = "insight-item";
    const recommendationClass = rec.mode === "duplo" ? "duplo" : rec.mode === "triplo" ? "triplo" : "";
    const isDisagreed = disagreementGameIds.has(game.id);
    const suggested = rec.picks.map((p) => outcomeLabel[p]).join("/");
    const current = game.picks.map((p) => outcomeLabel[p]).join("/");
    const allocated = budgetMap.get(game.id) || 0;
    item.innerHTML = `
      <strong>Jogo ${game.id}: ${game.home} vs ${game.away}</strong>
      <p class="insight-meta">
        <span class="insight-recommendation ${recommendationClass}">${rec.mode.toUpperCase()}</span>
        Sugerido: ${suggested} | Atual: ${current}
      </p>
      <p class="insight-meta">
        Confianca: ${(rec.bestProb * 100).toFixed(1)}% | Margem: ${(rec.margin * 100).toFixed(1)}% |
        Parcela do valor: ${formatCurrency(allocated)}
      </p>
      <label class="insight-toggle">
        <input type="checkbox" data-disagree="${game.id}" ${isDisagreed ? "checked" : ""} />
        Nao concordo com a sugestao automatica deste jogo
      </label>
      <div class="insight-detail" ${isDisagreed ? "" : "hidden"}>
        <p class="insight-meta">Detalhamento: ajuste este jogo sem mexer nos demais.</p>
        <div class="insight-actions">
          <button type="button" class="secondary-btn" data-mode="simples" data-game-id="${game.id}">Aplicar simples</button>
          <button type="button" class="secondary-btn" data-mode="duplo" data-game-id="${game.id}">Aplicar duplo</button>
          <button type="button" class="secondary-btn" data-mode="triplo" data-game-id="${game.id}">Aplicar triplo</button>
        </div>
      </div>
    `;
    root.appendChild(item);
  });

  root.querySelectorAll("input[data-disagree]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const gameId = Number(event.target.getAttribute("data-disagree"));
      if (event.target.checked) disagreementGameIds.add(gameId);
      else disagreementGameIds.delete(gameId);
      renderGameInsights(appliedPicks);
    });
  });

  root.querySelectorAll("button[data-mode][data-game-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      const gameId = Number(btn.getAttribute("data-game-id"));
      setGamePicksByMode(gameId, mode);
      setAnalysisBudgetStatus(`Jogo ${gameId} ajustado manualmente para ${mode}.`);
    });
  });
}

function chooseBestCompositionForBudget(maxBudget) {
  if (!Number.isFinite(maxBudget) || maxBudget < 1) return null;
  const secas = pickSecas(games);
  const candidates = enumerateBudgetCompositions().filter((c) => c.cost <= maxBudget);
  if (candidates.length === 0) return null;

  let best = null;
  candidates.forEach((metrics) => {
    const comp = wrapMetricsAsComposition(metrics);
    const ticket = applyComposition(games, secas, comp);
    const stats = computeTicketStats(ticket);
    const score = stats.p14 + stats.coverage / 1000 - stats.combos / 100000;
    if (!best || score > best.score) {
      best = { comp, stats, score };
    }
  });

  return best;
}

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mockFormRows(perspective, seedBase) {
  const rand = mulberry32(seedBase);
  const opponents = ["ADV A", "ADV B", "ADV C", "ADV D", "ADV E", "ADV F", "ADV G", "ADV H", "ADV I", "ADV J"];
  const rows = [];
  for (let i = 0; i < 10; i += 1) {
    const gh = Math.floor(rand() * 4);
    const ga = Math.floor(rand() * 4);
    let res = "E";
    if (gh > ga) res = perspective === "home" ? "V" : "D";
    else if (gh < ga) res = perspective === "home" ? "D" : "V";
    rows.push({ opp: opponents[i] || `Op ${i + 1}`, res, score: `${gh}x${ga}` });
  }
  return rows;
}

function fillVolanteStatsTable(tableEl, rows) {
  if (!tableEl) return;
  tableEl.innerHTML = `
    <thead><tr><th>Adversario</th><th>Placar</th><th>Res.</th></tr></thead>
    <tbody>
      ${rows
        .map((r) => `<tr><td>${r.opp}</td><td>${r.score}</td><td>${r.res}</td></tr>`)
        .join("")}
    </tbody>
  `;
}

function renderVolanteMeta() {
  const contestEl = document.getElementById("volante-meta-contest");
  const dateEl = document.getElementById("volante-meta-date");
  const periodEl = document.getElementById("volante-meta-period");
  if (contestEl) contestEl.textContent = currentContestNumber || "-";
  if (dateEl) dateEl.textContent = currentContestDate || "-";
  const periodBits = [];
  if (currentBettingPeriod) periodBits.push(`Apostas: ${currentBettingPeriod}`);
  if (currentGamesPeriod) periodBits.push(`Jogos: ${currentGamesPeriod}`);
  if (periodEl) periodEl.textContent = periodBits.length ? periodBits.join(" | ") : "-";
}

function ticketWithModalPreview() {
  if (volanteModalGameId == null) return appliedPicks;
  const nextPicks = normalizeManualPicks(volanteModalPicks);
  if (nextPicks.length === 0) return appliedPicks;
  return appliedPicks.map((g) => (g.id === volanteModalGameId ? { ...g, picks: nextPicks } : g));
}

function updateVolanteModalLive() {
  const el = document.getElementById("volante-modal-live");
  if (!el) return;
  const t = ticketWithModalPreview();
  const { combos, distribution, p14 } = computeTicketStats(t);
  el.textContent =
    `Valor do volante (preview): ${formatCurrency(combos)} — ${combos} combinacoes — ` +
    `${formatCompositionHumanPT(distribution.duplos, distribution.triplos)} — P14 modelo ${formatPercent(p14 * 100)}`;
}

function updateVolanteLiveBar(ticket) {
  const el = document.getElementById("volante-live-cost");
  if (!el || !ticket || !ticket.length) return;
  const { combos, distribution, p14 } = computeTicketStats(ticket);
  el.textContent =
    `Valor do volante: ${formatCurrency(combos)} — ${combos} combinacoes — ` +
    `${formatCompositionHumanPT(distribution.duplos, distribution.triplos)} — P14 modelo ${formatPercent(p14 * 100)}`;
}

function pickKindLabel(game) {
  const n = game.picks.length;
  if (n >= 3) return "Triplo";
  if (n === 2) return "Duplo";
  return "Seca";
}

function renderVolanteGrid() {
  const root = document.getElementById("volante-grid");
  if (!root || !appliedPicks.length) return;
  root.innerHTML = "";
  appliedPicks.forEach((game) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `volante-card ${volanteVisited.has(game.id) ? "volante-card--done" : ""}`.trim();
    card.setAttribute("data-game-id", String(game.id));
    const initials = game.picks.map((x) => outcomeLabel[x][0]).join("");
    card.innerHTML = `
      <span class="volante-card-mark" aria-hidden="true">${volanteVisited.has(game.id) ? "✓" : ""}</span>
      <span class="volante-card-num">Jogo ${game.id}</span>
      <span class="volante-card-match">${game.home} <span class="volante-vs">x</span> ${game.away}</span>
      <span class="volante-card-picks">${game.picks.map((s) => outcomeLabel[s]).join(" · ")}</span>
      <span class="volante-card-kind">${pickKindLabel(game)} (${initials})</span>
    `;
    card.addEventListener("click", () => openVolanteModal(game.id));
    root.appendChild(card);
  });
}

function closeVolanteModal() {
  const modal = document.getElementById("volante-game-modal");
  if (modal) modal.hidden = true;
  const live = document.getElementById("volante-modal-live");
  if (live) live.textContent = "";
  volanteModalGameId = null;
  volanteModalPicks = [];
}

function openVolanteModal(gameId) {
  const game = appliedPicks.find((g) => g.id === gameId);
  if (!game) return;
  volanteModalGameId = gameId;
  volanteModalPicks = [...game.picks];
  const modal = document.getElementById("volante-game-modal");
  const title = document.getElementById("volante-modal-title");
  const probs = document.getElementById("volante-modal-probs");
  if (title) title.textContent = `Jogo ${game.id} — ${game.home} x ${game.away}`;
  if (probs) {
    probs.textContent = `Modelo 1x2: H ${(game.probabilities.H * 100).toFixed(0)}% | D ${(game.probabilities.D * 100).toFixed(0)}% | A ${(game.probabilities.A * 100).toFixed(0)}%`;
  }
  const hSeed = seedFromStr(`home:${game.home}:${game.away}`);
  const aSeed = seedFromStr(`away:${game.away}:${game.home}`);
  fillVolanteStatsTable(document.getElementById("volante-stats-home"), mockFormRows("home", hSeed));
  fillVolanteStatsTable(document.getElementById("volante-stats-away"), mockFormRows("away", aSeed));
  renderVolanteModalChips();
  if (modal) modal.hidden = false;
}

function renderVolanteModalChips() {
  const row = document.getElementById("volante-modal-chips");
  if (!row) return;
  row.innerHTML = "";
  ["H", "D", "A"].forEach((symbol) => {
    const chip = document.createElement("button");
    chip.type = "button";
    const active = volanteModalPicks.includes(symbol);
    chip.className = `volante-modal-chip ${active ? "active" : ""}`.trim();
    chip.textContent = outcomeLabel[symbol];
    chip.setAttribute("aria-pressed", String(active));
    chip.addEventListener("click", () => {
      if (volanteModalPicks.includes(symbol)) {
        if (volanteModalPicks.length <= 1) return;
        volanteModalPicks = volanteModalPicks.filter((p) => p !== symbol);
      } else {
        volanteModalPicks = [...volanteModalPicks, symbol].sort(
          (a, b) => ["H", "D", "A"].indexOf(a) - ["H", "D", "A"].indexOf(b)
        );
      }
      renderVolanteModalChips();
    });
    row.appendChild(chip);
  });
  updateVolanteModalLive();
}

function applyVolanteModalPicks() {
  if (volanteModalGameId == null) return;
  const game = appliedPicks.find((g) => g.id === volanteModalGameId);
  if (!game) return;
  const next = normalizeManualPicks(volanteModalPicks);
  if (next.length === 0) return;
  game.picks = next;
  volanteVisited.add(volanteModalGameId);
  selectedRiskPreset = "custom";
  syncRiskPresetControl();
  closeVolanteModal();
  renderGames(appliedPicks);
  updateResult(appliedPicks);
  saveState();
}

function setupVolanteBoard() {
  const btn = document.getElementById("volante-invest-btn");
  const input = document.getElementById("volante-invest-input");
  const hint = document.getElementById("volante-invest-hint");
  const backdrop = document.getElementById("volante-modal-backdrop");
  const closeBtn = document.getElementById("volante-modal-close");
  const cancelBtn = document.getElementById("volante-modal-cancel");
  const saveBtn = document.getElementById("volante-modal-save");
  const modal = document.getElementById("volante-game-modal");

  if (btn && input && hint) {
    btn.addEventListener("click", () => {
      const budget = Number(input.value);
      const result = chooseBestCompositionForBudget(budget);
      if (!result) {
        hint.textContent =
          "Nao ha composicao valida dentro desse valor (tente um valor maior ou verifique o minimo de R$1).";
        return;
      }
      const { comp, stats } = result;
      selectedComposition = comp;
      selectedRiskPreset = detectPresetByDistribution({
        duplos: comp.duplos,
        triplos: comp.triplos
      });
      const secas = pickSecas(games);
      appliedPicks = applyComposition(games, secas, comp);
      volanteVisited = new Set();
      syncRiskPresetControl();
      renderGames(appliedPicks);
      renderSuggestions(secas);
      renderCompositions();
      updateResult(appliedPicks);
      saveState();
      const human = formatCompositionHumanPT(comp.duplos, comp.triplos);
      hint.textContent =
        `Para ate ${formatCurrency(budget)}: sugestao ${human} — perfil "${comp.name}", custo ${formatCurrency(comp.cost)}, ` +
        `combinacoes ${stats.combos}, chance modelo P14 ${formatPercent(stats.p14 * 100)}. Ajuste jogo a jogo no quadro abaixo.`;
    });
  }

  function onClose() {
    closeVolanteModal();
  }
  if (backdrop) backdrop.addEventListener("click", onClose);
  if (closeBtn) closeBtn.addEventListener("click", onClose);
  if (cancelBtn) cancelBtn.addEventListener("click", onClose);
  if (saveBtn) saveBtn.addEventListener("click", () => applyVolanteModalPicks());

  if (modal) {
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") onClose();
    });
  }
}

function renderGames(ticket) {
  const root = document.getElementById("games-grid");
  if (!root) return;
  root.innerHTML = "";
  const table = document.createElement("table");
  table.className = "round-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Jogo</th>
        <th>Coluna 1 (Casa)</th>
        <th>X</th>
        <th>Coluna 2 (Fora)</th>
        <th>Data</th>
        <th>Palpites</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  ticket.forEach((game) => {
    const tr = document.createElement("tr");

    const gameCell = document.createElement("td");
    gameCell.className = "game-index";
    gameCell.textContent = String(game.id);

    const homeCell = document.createElement("td");
    homeCell.innerHTML = `<strong>${game.home}</strong>`;

    const drawCell = document.createElement("td");
    drawCell.className = "draw-cell";
    drawCell.textContent = "Empate";

    const awayCell = document.createElement("td");
    awayCell.innerHTML = `<strong>${game.away}</strong>`;

    const dateCell = document.createElement("td");
    dateCell.className = "draw-cell";
    dateCell.textContent = game.gameDate || "-";

    const picksCell = document.createElement("td");
    picksCell.className = "picks-cell";

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

    const probs = document.createElement("small");
    probs.className = "prob-inline";
    probs.textContent =
      `H ${(game.probabilities.H * 100).toFixed(0)}% | ` +
      `D ${(game.probabilities.D * 100).toFixed(0)}% | ` +
      `A ${(game.probabilities.A * 100).toFixed(0)}%`;

    picksCell.append(row, probs);
    tr.append(gameCell, homeCell, drawCell, awayCell, dateCell, picksCell);
    tbody.appendChild(tr);
  });

  root.appendChild(table);
  renderRoundOfficialInfo();
  renderVolanteMeta();
  renderVolanteGrid();
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
  renderGameInsights(ticket);
  updateVolanteLiveBar(ticket);
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

function getSuggestedTicket() {
  return applyComposition(games, pickSecas(games), selectedComposition);
}

function resetGameWizard() {
  wizardStepIndex = null;
  const ws = document.getElementById("game-wizard-workspace");
  if (ws) ws.hidden = true;
  const ob = document.getElementById("wizard-open-btn");
  if (ob) {
    ob.setAttribute("aria-expanded", "false");
    ob.textContent = "Abrir assistente";
  }
}

function formatWizardPicks(picks) {
  return picks.map((p) => outcomeLabel[p] || p).join(" + ");
}

function getWizardConfirmedCount() {
  if (wizardStepIndex === null) return 0;
  if (wizardStepIndex === "done") return 14;
  return wizardStepIndex;
}

function renderWizardSummary() {
  const ol = document.getElementById("wizard-summary-list");
  if (!ol) return;
  ol.replaceChildren();
  const n = getWizardConfirmedCount();
  for (let i = 0; i < n; i += 1) {
    const g = appliedPicks[i];
    if (!g) continue;
    const li = document.createElement("li");
    li.textContent = `${String(i + 1).padStart(2, "0")} — ${g.home} x ${g.away}: ${formatWizardPicks(g.picks)}`;
    ol.appendChild(li);
  }
}

function syncWizardCritUI() {
  const crit = document.querySelector('input[name="wizard-crit"]:checked')?.value || "volante";
  const rap = document.getElementById("wizard-rapido-detail");
  const man = document.getElementById("wizard-manual-row");
  if (rap) rap.hidden = crit !== "rapido";
  if (man) {
    man.hidden = crit !== "manual";
    if (crit === "manual") buildWizardManualChips();
  }
}

function buildWizardManualChips() {
  const root = document.getElementById("wizard-manual-row");
  if (!root) return;
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "wizard-chip-row";
  const order = ["H", "D", "A"];
  order.forEach((sym) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `wizard-chip ${wizardManualSymbols.includes(sym) ? "active" : ""}`.trim();
    btn.textContent = outcomeLabel[sym];
    btn.addEventListener("click", () => {
      if (wizardManualSymbols.includes(sym)) {
        if (wizardManualSymbols.length <= 1) return;
        wizardManualSymbols = wizardManualSymbols.filter((x) => x !== sym);
      } else {
        wizardManualSymbols = [...wizardManualSymbols, sym].sort(
          (a, b) => order.indexOf(a) - order.indexOf(b)
        );
      }
      buildWizardManualChips();
    });
    wrap.appendChild(btn);
  });
  root.appendChild(wrap);
}

function renderGameWizard() {
  const ws = document.getElementById("game-wizard-workspace");
  const activeBlock = document.getElementById("wizard-active-block");
  const doneBanner = document.getElementById("wizard-done-banner");
  if (!ws || ws.hidden || wizardStepIndex === null) return;

  if (wizardStepIndex === "done") {
    if (activeBlock) activeBlock.hidden = true;
    if (doneBanner) {
      doneBanner.hidden = false;
      doneBanner.textContent =
        "Voce confirmou os 14 jogos. Os palpites estao na tabela abaixo e na combinacao ao lado. " +
        "Use Fechar assistente ou ajuste na tabela se precisar.";
    }
    renderWizardSummary();
    return;
  }

  if (activeBlock) activeBlock.hidden = false;
  if (doneBanner) doneBanner.hidden = true;

  const idx = wizardStepIndex;
  const game = games[idx];
  const row = appliedPicks[idx];
  if (!game || !row) return;

  const sug = getSuggestedTicket()[idx];
  const tipo = classifyTicketRowType(row.id, row.picks.length);
  const rec = classifyGameRecommendation(game);

  const stepNum = document.getElementById("wizard-step-num");
  const stepSt = document.getElementById("wizard-step-status");
  if (stepNum) stepNum.textContent = String(idx + 1);
  if (stepSt) stepSt.textContent = ` — tipo de linha no volante: ${tipo}`;

  const mt = document.getElementById("wizard-match-title");
  if (mt) mt.textContent = `${game.home}  x  ${game.away}`;

  const { H, D, A } = game.probabilities;
  const imp = document.getElementById("wizard-implied-row");
  if (imp) {
    imp.textContent = `Odds implicitas (~1/prob.): Casa @ ${(1 / H).toFixed(2)} | Empate @ ${(1 / D).toFixed(
      2
    )} | Fora @ ${(1 / A).toFixed(2)}`;
  }

  const sg = document.getElementById("wizard-suggestion-row");
  if (sg) {
    sg.textContent = `Sugestao do volante (composicao): ${formatWizardPicks(sug.picks)}`;
  }

  const rap = document.getElementById("wizard-rapido-detail");
  if (rap) {
    rap.textContent = `Neste criterio: ${rec.mode} — ${formatWizardPicks(
      getRecommendedPicksForGame(game, rec.mode)
    )} (baseado so nas probabilidades do jogo).`;
  }

  wizardManualSymbols = [...row.picks];

  const backBtn = document.getElementById("wizard-back-btn");
  if (backBtn) backBtn.disabled = idx <= 0;

  const okBtn = document.getElementById("wizard-ok-btn");
  if (okBtn) {
    okBtn.disabled = false;
    okBtn.textContent = idx >= 13 ? "OK — finalizar volante" : "OK — proximo jogo";
  }

  syncWizardCritUI();
  renderWizardSummary();
}

function applyWizardStepAndAdvance() {
  if (wizardStepIndex === null || wizardStepIndex === "done") return;
  const idx = wizardStepIndex;
  const crit = document.querySelector('input[name="wizard-crit"]:checked')?.value || "volante";
  let picks;
  if (crit === "volante") picks = [...getSuggestedTicket()[idx].picks];
  else if (crit === "rapido") {
    const rec = classifyGameRecommendation(games[idx]);
    picks = getRecommendedPicksForGame(games[idx], rec.mode);
  } else {
    picks = normalizeManualPicks([...wizardManualSymbols]);
    if (picks.length === 0) {
      appendLog("Marque ao menos um resultado (Casa, Empate ou Fora).", "warn");
      return;
    }
  }

  appliedPicks[idx].picks = picks;
  selectedRiskPreset = "custom";
  syncRiskPresetControl();
  renderGames(appliedPicks);
  updateResult(appliedPicks);
  saveState();

  if (idx >= 13) {
    wizardStepIndex = "done";
  } else {
    wizardStepIndex = idx + 1;
    document.querySelectorAll('input[name="wizard-crit"]').forEach((r) => {
      if (r.value === "volante") r.checked = true;
    });
  }
  renderGameWizard();
}

function setupGameWizard() {
  const openBtn = document.getElementById("wizard-open-btn");
  const ws = document.getElementById("game-wizard-workspace");
  const okBtn = document.getElementById("wizard-ok-btn");
  const backBtn = document.getElementById("wizard-back-btn");
  if (!openBtn || !ws) return;

  openBtn.addEventListener("click", () => {
    const show = ws.hidden;
    ws.hidden = !show;
    openBtn.setAttribute("aria-expanded", show ? "true" : "false");
    openBtn.textContent = show ? "Fechar assistente" : "Abrir assistente";
    if (show) {
      if (wizardStepIndex === null || wizardStepIndex === "done") {
        wizardStepIndex = 0;
      }
      renderGameWizard();
    }
  });

  document.querySelectorAll('input[name="wizard-crit"]').forEach((r) => {
    r.addEventListener("change", () => syncWizardCritUI());
  });

  if (okBtn) {
    okBtn.addEventListener("click", () => applyWizardStepAndAdvance());
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (wizardStepIndex === null || wizardStepIndex === "done" || wizardStepIndex <= 0) return;
      wizardStepIndex -= 1;
      renderGameWizard();
    });
  }
}

function refreshView() {
  resetGameWizard();
  volanteVisited = new Set();
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
  const analysisBudgetInput = document.getElementById("analysis-budget-input");
  const analysisBudgetBtn = document.getElementById("analysis-budget-btn");
  const contestNumberInput = document.getElementById("contest-number-input");
  const contestDateInput = document.getElementById("contest-date-input");
  const contestResultInput = document.getElementById("contest-result-input");
  const saveContestBtn = document.getElementById("save-contest-btn");
  const loadContestBtn = document.getElementById("load-contest-btn");
  const checkResultBtn = document.getElementById("check-result-btn");
  const fetchCaixaResultBtn = document.getElementById("fetch-caixa-result-btn");
  const applyCaixaJsonBtn = document.getElementById("apply-caixa-json-btn");
  const caixaJsonPaste = document.getElementById("caixa-json-paste");
  const autoConferAfterFetch = document.getElementById("auto-confer-after-fetch");

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
      `Melhor composicao ate ${formatCurrency(budget)}: ${formatCompositionHumanPT(result.comp.duplos, result.comp.triplos)} ` +
        `(${result.comp.name}, custo ${formatCurrency(result.comp.cost)}).`
    );
  });

  analysisBudgetBtn.addEventListener("click", () => {
    const value = Number(analysisBudgetInput.value);
    if (!Number.isFinite(value) || value <= 0) {
      setAnalysisBudgetStatus("Informe um valor valido para analise.", true);
      return;
    }
    analysisBudget = value;
    renderGameInsights(appliedPicks);
    const detailCount = disagreementGameIds.size;
    setAnalysisBudgetStatus(
      `Analise atualizada para ${formatCurrency(value)}. Jogos em detalhamento: ${detailCount}.`
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
      currentBettingPeriod = payload.bettingPeriod || "";
      currentGamesPeriod = payload.gamesPeriod || "";
      localStorage.setItem(
        ROUND_DATA_KEY,
        JSON.stringify({
          contestNumber: currentContestNumber,
          contestDate: currentContestDate,
          bettingPeriod: currentBettingPeriod,
          gamesPeriod: currentGamesPeriod,
          games: payload.games
        })
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
    currentBettingPeriod = "";
    currentGamesPeriod = "";
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
    performContestResultCheck();
  });

  if (fetchCaixaResultBtn) {
    fetchCaixaResultBtn.addEventListener("click", async () => {
      const typed = contestNumberInput.value.trim();
      const num = typed ? Number(typed) : NaN;
      const useNum = Number.isInteger(num) && num > 0 ? num : "";
      setContestStatus("Consultando API da Caixa...", false);
      fetchCaixaResultBtn.disabled = true;
      try {
        const { buildCaixaLotecaUrl } = await import("./lib/caixa-loteca.mjs");
        const url = buildCaixaLotecaUrl(useNum);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json();
        const applied = await applyCaixaApiPayload(payload, { syncMeta: true });
        if (!applied.ok) {
          setContestStatus(applied.reason, true);
          appendLog(`API Caixa: ${applied.reason}`, "warn");
          return;
        }
        const nLabel = applied.numero != null ? applied.numero : "?";
        setContestStatus(`Resultado oficial carregado (concurso ${nLabel}, Caixa).`);
        appendLog(`Resultado Loteca obtido via API Caixa (concurso ${nLabel}).`);
        if (autoConferAfterFetch && autoConferAfterFetch.checked) {
          performContestResultCheck();
        }
      } catch (error) {
        const msg = error && error.message ? error.message : String(error);
        setContestStatus(
          `Nao foi possivel buscar automaticamente (${msg}). Abra o link do JSON oficial no painel e cole o texto em \"Colar JSON da Caixa\".`,
          true
        );
        appendLog(`Erro API Caixa (CORS/rede): ${msg}`, "warn");
      } finally {
        fetchCaixaResultBtn.disabled = false;
      }
    });
  }

  if (applyCaixaJsonBtn && caixaJsonPaste) {
    applyCaixaJsonBtn.addEventListener("click", async () => {
      const raw = caixaJsonPaste.value.trim();
      if (!raw) {
        setContestStatus("Cole o JSON retornado pela API da Caixa antes de aplicar.", true);
        return;
      }
      try {
        const payload = JSON.parse(raw);
        const applied = await applyCaixaApiPayload(payload, { syncMeta: true });
        if (!applied.ok) {
          setContestStatus(applied.reason, true);
          return;
        }
        const nLabel = applied.numero != null ? applied.numero : "?";
        setContestStatus(`JSON aplicado (concurso ${nLabel}).`);
        appendLog(`Resultado Loteca aplicado a partir de JSON colado (concurso ${nLabel}).`);
        if (autoConferAfterFetch && autoConferAfterFetch.checked) {
          performContestResultCheck();
        }
      } catch (_error) {
        setContestStatus("JSON invalido. Verifique se copiou o arquivo completo da API.", true);
      }
    });
  }

  const exportOfficialCsvBtn = document.getElementById("export-official-csv-btn");
  if (exportOfficialCsvBtn) {
    exportOfficialCsvBtn.addEventListener("click", () => {
      if (!lastOfficialAnalysisCsv) {
        setContestStatus('Execute "Conferir acertos" com resultado valido antes de exportar.', true);
        return;
      }
      const blob = new Blob([lastOfficialAnalysisCsv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "loesin-analise-oficial-volante.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      appendLog("CSV de analise oficial x volante exportado.");
    });
  }
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
  const packagedContest = await loadPackagedContest();

  const sourcePayload = importedRound
    ? extractRoundPayload(importedRound)
    : packagedContest
      ? extractRoundPayload(packagedContest)
      : { games: await loadGames(), contestNumber: "", contestDate: "" };
  const roundValidation = validateRoundGames(sourcePayload.games);
  const initialGames = roundValidation.ok ? sourcePayload.games : fallbackGames;
  currentContestNumber = sourcePayload.contestNumber || "";
  currentContestDate = sourcePayload.contestDate || "";
  currentBettingPeriod = sourcePayload.bettingPeriod || "";
  currentGamesPeriod = sourcePayload.gamesPeriod || "";
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
    if (Array.isArray(state.volanteVisited)) {
      volanteVisited = new Set(state.volanteVisited.filter((id) => Number.isFinite(id)));
    }
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
  setupVolanteBoard();
  renderErrorLogs();
  setAnalysisBudgetStatus(`Analise inicial pronta com orcamento de ${formatCurrency(analysisBudget)}.`);
  if ((importedRound || packagedContest) && roundValidation.ok) {
    setRoundBadge("official");
    if (importedRound) {
      setRoundStatus("Rodada personalizada carregada do armazenamento local.");
    } else {
      setRoundStatus(`Concurso ${currentContestNumber || "1242"} carregado automaticamente.`);
    }
  } else {
    setRoundBadge("mock");
    setRoundStatus("Rodada mock carregada.");
  }

  setupOddsMarketPanel();
  setupHubNavigation();
  setupGameWizard();
}

function setupHubNavigation() {
  const nav = document.querySelector(".hub-nav");
  if (!nav) return;
  const panes = {
    loteca: document.getElementById("hub-pane-loteca"),
    odds: document.getElementById("hub-pane-odds"),
    arquivo: document.getElementById("hub-pane-arquivo")
  };
  const buttons = nav.querySelectorAll(".hub-nav-btn[data-hub]");
  function showPane(key) {
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      const on = k === key;
      el.hidden = !on;
      el.classList.toggle("hub-pane--active", on);
    });
    buttons.forEach((b) => {
      const k = b.getAttribute("data-hub");
      const active = k === key;
      b.classList.toggle("hub-nav-btn--active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-hub");
      if (key) showPane(key);
    });
  });
}

function parseOddsCell(val, mod) {
  if (val == null || String(val).trim() === "") return null;
  const p = mod.parseOddsToken(String(val).trim());
  if (p.error) return null;
  return p.decimal;
}

function setupOddsMarketPanel() {
  const convertBtn = document.getElementById("odds-convert-btn");
  const compareBtn = document.getElementById("odds-compare-btn");
  const evBtn = document.getElementById("odds-ev-btn");
  const dutchBtn = document.getElementById("odds-dutch-btn");
  if (!convertBtn) return;

  convertBtn.addEventListener("click", async () => {
    const raw = document.getElementById("odds-convert-input")?.value || "";
    const out = document.getElementById("odds-convert-out");
    if (!out) return;
    const mod = await import("./lib/odds-tools.mjs");
    const p = mod.parseOddsToken(raw.trim());
    if (p.error) {
      out.textContent = `Nao foi possivel interpretar: ${p.error}`;
      return;
    }
    const d = p.decimal;
    const impl = mod.impliedGrossFromDecimal(d);
    const am = mod.americanFromDecimal(d);
    const fr = mod.fractionalDisplayFromDecimal(d);
    out.textContent = [
      `Formato detectado: ${p.format}`,
      `Decimal: ${d.toFixed(4)}`,
      `Americana: ${am != null && am > 0 ? "+" : ""}${am}`,
      `Fracao (aprox.): ${fr}`,
      `Prob. implicita bruta: ${impl != null ? (impl * 100).toFixed(2) + "%" : "-"}`
    ].join("\n");
  });

  if (compareBtn) {
    compareBtn.addEventListener("click", async () => {
      const out = document.getElementById("odds-compare-out");
      if (!out) return;
      const mod = await import("./lib/odds-tools.mjs");
      const lines = [];
      let any = false;
      let bestH = { o: 0, book: "" };
      let bestD = { o: 0, book: "" };
      let bestA = { o: 0, book: "" };
      for (let i = 0; i < 6; i += 1) {
        const nameEl = document.getElementById(`odds-n${i}`);
        const name = (nameEl && nameEl.value.trim()) || `Casa ${i + 1}`;
        const h = parseOddsCell(document.getElementById(`odds-b${i}-h`)?.value, mod);
        const d = parseOddsCell(document.getElementById(`odds-b${i}-d`)?.value, mod);
        const a = parseOddsCell(document.getElementById(`odds-b${i}-a`)?.value, mod);
        if (h == null && d == null && a == null) continue;
        if (h == null || d == null || a == null) {
          lines.push(`[${name}] Preencha H, D e A nesta coluna ou deixe todos vazios.`);
          continue;
        }
        const an = mod.analyzeThreeWay(h, d, a);
        if (!an.ok) {
          lines.push(`[${name}] ${an.reason}`);
          continue;
        }
        any = true;
        lines.push(`--- ${name} ---`);
        lines.push(
          `  Margem: ${(an.margin * 100).toFixed(2)}% | Fair H/D/A: ${an.fairPct.H.toFixed(1)}% / ${an.fairPct.D.toFixed(1)}% / ${an.fairPct.A.toFixed(1)}%`
        );
        lines.push(
          `  Implicitas brutas: ${an.impliedPct.H.toFixed(1)}% / ${an.impliedPct.D.toFixed(1)}% / ${an.impliedPct.A.toFixed(1)}%`
        );
        if (h > bestH.o) bestH = { o: h, book: name };
        if (d > bestD.o) bestD = { o: d, book: name };
        if (a > bestA.o) bestA = { o: a, book: name };
      }
      if (!any) {
        out.textContent = "Preencha pelo menos uma coluna completa (H, D e A).";
        return;
      }
      lines.push("");
      lines.push("Melhores odds (decimal mais alto por resultado):");
      if (bestH.o > 0) lines.push(`  H: ${bestH.o.toFixed(2)} @ ${bestH.book}`);
      if (bestD.o > 0) lines.push(`  D: ${bestD.o.toFixed(2)} @ ${bestD.book}`);
      if (bestA.o > 0) lines.push(`  A: ${bestA.o.toFixed(2)} @ ${bestA.book}`);
      out.textContent = lines.join("\n");
    });
  }

  if (evBtn) {
    evBtn.addEventListener("click", async () => {
      const out = document.getElementById("odds-ev-out");
      if (!out) return;
      const mod = await import("./lib/odds-tools.mjs");
      const fairPct = Number(document.getElementById("odds-ev-fair")?.value);
      const raw = document.getElementById("odds-ev-dec")?.value || "";
      const p = mod.parseOddsToken(raw.trim());
      if (p.error) {
        out.textContent = "Odd invalida. Use decimal, americana ou fracao.";
        return;
      }
      if (!(fairPct > 0 && fairPct < 100)) {
        out.textContent = "Prob. justa deve estar entre 0 e 100.";
        return;
      }
      const fair = fairPct / 100;
      const ev = mod.expectedValueDecimal(fair, p.decimal);
      const implOffered = mod.impliedGrossFromDecimal(p.decimal);
      const tail =
        ev != null && ev > 0
          ? "Expectativa positiva (valor) se a prob. justa estiver correta."
          : ev != null
            ? "EV nulo ou negativo nesta odd com sua prob. justa."
            : "";
      out.textContent = [
        `Odd decimal: ${p.decimal.toFixed(4)}`,
        `Prob. implicita da oferta: ${implOffered != null ? (implOffered * 100).toFixed(2) + "%" : "-"}`,
        `Sua prob. justa: ${fairPct.toFixed(2)}%`,
        `EV por unidade apostada: ${ev != null ? (ev * 100).toFixed(2) + "%" : "-"}`,
        tail
      ].join("\n");
    });
  }

  if (dutchBtn) {
    dutchBtn.addEventListener("click", async () => {
      const out = document.getElementById("odds-dutch-out");
      if (!out) return;
      const mod = await import("./lib/odds-tools.mjs");
      const txt = document.getElementById("odds-dutch-list")?.value || "";
      const total = Number(document.getElementById("odds-dutch-total")?.value);
      const parts = txt
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const decimals = [];
      for (const part of parts) {
        const p = mod.parseOddsToken(part);
        if (p.error) {
          out.textContent = `Nao entendi a odd: ${part}`;
          return;
        }
        decimals.push(p.decimal);
      }
      if (decimals.length < 2) {
        out.textContent = "Informe pelo menos duas odds.";
        return;
      }
      if (!(total > 0)) {
        out.textContent = "Banca total invalida.";
        return;
      }
      const r = mod.dutchingStakes(decimals, total);
      if (!r) {
        out.textContent = "Erro no calculo.";
        return;
      }
      const lines = ["Stakes (retorno alvo igual se uma selecao vencer):"];
      r.stakes.forEach((st, i) => {
        lines.push(`  #${i + 1} odd ${decimals[i].toFixed(2)} -> R$ ${st.toFixed(2)}`);
      });
      lines.push(`Retorno se acertar uma: R$ ${r.impliedReturn.toFixed(2)}`);
      lines.push(`Lucro liquido vs banca: R$ ${r.roiIfAnyWins.toFixed(2)}`);
      if (r.roiIfAnyWins < -0.005) {
        lines.push("Nota: em mercados com margem, lucro liquido costuma ser negativo (sem arbitragem).");
      }
      out.textContent = lines.join("\n");
    });
  }
}

window.addEventListener("error", (event) => {
  appendLog(event.message || "Erro inesperado de runtime.", "error");
});
window.addEventListener("unhandledrejection", (event) => {
  appendLog(`Promise rejeitada: ${event.reason}`, "error");
});

bootstrap();
