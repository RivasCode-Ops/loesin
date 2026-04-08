import test from "node:test";
import assert from "node:assert/strict";
import { chanceOfHit, chooseBestCompositionForBudget, compositionMetrics, getDistribution } from "../lib/core.mjs";

test("composition metrics computes combinations and coverage", () => {
  const result = compositionMetrics(4, 1);
  assert.equal(result.combos, 48);
  assert.equal(result.cost, 48);
  assert.equal(result.coverage.toFixed(1), "42.9");
});

test("distribution counts duplos and triplos", () => {
  const ticket = [
    { picks: ["H"] },
    { picks: ["H", "D"] },
    { picks: ["H", "D", "A"] },
    { picks: ["A", "D"] }
  ];
  const d = getDistribution(ticket);
  assert.equal(d.duplos, 2);
  assert.equal(d.triplos, 1);
});

test("chance multiplies covered probabilities", () => {
  const ticket = [
    { probabilities: { H: 0.6, D: 0.2, A: 0.2 }, picks: ["H"] },
    { probabilities: { H: 0.4, D: 0.3, A: 0.3 }, picks: ["D", "A"] }
  ];
  const p = chanceOfHit(ticket);
  assert.equal(Number(p.toFixed(3)), 0.36);
});

test("budget optimizer returns best candidate under cap", () => {
  const comps = [
    { name: "Conservadora", cost: 8 },
    { name: "Equilibrada", cost: 48 },
    { name: "Agressiva", cost: 432 }
  ];
  const scored = {
    Conservadora: { p14: 0.00005, coverage: 21.4, combos: 8 },
    Equilibrada: { p14: 0.00008, coverage: 42.9, combos: 48 },
    Agressiva: { p14: 0.00012, coverage: 64.3, combos: 432 }
  };
  const best = chooseBestCompositionForBudget(comps, scored, 50);
  assert.equal(best.comp.name, "Equilibrada");
});
