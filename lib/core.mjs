export function compositionMetrics(duplos, triplos) {
  const combos = 2 ** duplos * 3 ** triplos;
  const coverage = ((duplos + triplos * 2) / 14) * 100;
  return { duplos, triplos, combos, coverage, cost: combos };
}

export function getDistribution(ticket) {
  return ticket.reduce(
    (acc, game) => {
      if (game.picks.length === 2) acc.duplos += 1;
      if (game.picks.length === 3) acc.triplos += 1;
      return acc;
    },
    { duplos: 0, triplos: 0 }
  );
}

export function chanceOfHit(ticket) {
  return ticket.reduce((acc, game) => {
    const covered = game.picks.reduce((sum, symbol) => sum + game.probabilities[symbol], 0);
    return acc * covered;
  }, 1);
}

export function chooseBestCompositionForBudget(compositions, scoredTicketsByName, budget) {
  const candidates = compositions.filter((c) => c.cost <= budget);
  if (candidates.length === 0) return null;
  let best = null;
  for (const comp of candidates) {
    const stats = scoredTicketsByName[comp.name];
    const score = stats.p14 + stats.coverage / 1000 - stats.combos / 100000;
    if (!best || score > best.score) best = { comp, stats, score };
  }
  return best;
}
