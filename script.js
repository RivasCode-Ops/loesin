const fallbackGames = [
  { home: "Flamengo", away: "Vasco", probabilities: { H: 0.65, D: 0.15, A: 0.2 } },
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

async function loadGames() {
  try {
    const response = await fetch("./data/games.json");
    if (!response.ok) throw new Error("mock data unavailable");
    return await response.json();
  } catch (_error) {
    return fallbackGames;
  }
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

  const conservative = all
    .filter((c) => c.cost <= 16 && c.triplos <= 1)
    .sort((a, b) => b.score - a.score)[0];

  const balanced = all
    .filter((c) => c.cost >= 24 && c.cost <= 96 && c.duplos >= 3)
    .sort((a, b) => b.score - a.score)[0];

  const aggressive = all
    .filter((c) => c.cost >= 96)
    .sort((a, b) => b.coverage - a.coverage || a.cost - b.cost)[0];

  return [
    { name: "Conservadora", ...conservative },
    { name: "Equilibrada", ...balanced, recommended: true },
    { name: "Agressiva", ...aggressive }
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

function chanceOfHit(ticket) {
  const p = ticket.reduce((acc, game) => {
    const coveredProb = game.picks.reduce((sum, symbol) => sum + game.probabilities[symbol], 0);
    return acc * coveredProb;
  }, 1);
  return Math.max(0, Math.min(1, p));
}

function formatPercent(value) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      const chip = document.createElement("span");
      const isSelected = game.picks.includes(symbol);
      chip.className = `pick-chip ${isSelected ? "active locked" : ""}`.trim();
      chip.textContent = outcomeLabel[symbol];
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

function updateResult(ticket) {
  const p14 = chanceOfHit(ticket);
  const inv = p14 > 0 ? Math.round(1 / p14) : 0;
  document.getElementById("coverage-value").textContent = formatPercent(selectedComposition.coverage);
  document.getElementById("coverage-combos").textContent = `${selectedComposition.combos} combinacoes cobertas`;
  document.getElementById("chance-value").textContent = inv ? `1 em ${inv.toLocaleString("pt-BR")}` : "1 em -";
  document.getElementById("chance-percent").textContent = formatPercent(p14 * 100);
  document.getElementById("cost-value").textContent = formatCurrency(selectedComposition.cost);
}

function buildTicketText(ticket) {
  const header = [
    "LOTERIA ESPORTIVA INTELIGENTE - VOLANTE SUGERIDO",
    `Composicao: ${selectedComposition.name} (${selectedComposition.duplos}D/${selectedComposition.triplos}T)`,
    `Cobertura: ${formatPercent(selectedComposition.coverage)} | Combinacoes: ${selectedComposition.combos}`,
    `Custo estimado: ${formatCurrency(selectedComposition.cost)}`,
    ""
  ];

  const lines = ticket.map((g) => {
    const picks = g.picks.map((p) => outcomeLabel[p]).join("/");
    return `Jogo ${g.id.toString().padStart(2, "0")} - ${g.home} x ${g.away}: ${picks}`;
  });
  return [...header, ...lines].join("\n");
}

function refreshView() {
  const secas = pickSecas(games);
  appliedPicks = applyComposition(games, secas, selectedComposition);
  renderGames(appliedPicks);
  renderSuggestions(secas);
  renderCompositions();
  updateResult(appliedPicks);
}

function setupActions() {
  const confirm = document.getElementById("confirm-build");
  const generateBtn = document.getElementById("generate-btn");
  const output = document.getElementById("ticket-output");

  confirm.addEventListener("change", () => {
    generateBtn.disabled = !confirm.checked;
  });

  generateBtn.addEventListener("click", () => {
    const text = buildTicketText(appliedPicks);
    output.value = text;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "volante-loesin.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function bootstrap() {
  const rawGames = await loadGames();
  games = buildAnalysis(rawGames).slice(0, 14);
  compositions = buildCompositions();
  selectedComposition = compositions.find((c) => c.recommended) || compositions[1] || compositions[0];
  refreshView();
  setupActions();
}

bootstrap();
