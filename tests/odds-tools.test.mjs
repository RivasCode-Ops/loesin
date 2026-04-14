import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOddsToken,
  impliedGrossFromDecimal,
  decimalFromAmerican,
  analyzeThreeWay,
  devigProportional,
  expectedValueDecimal,
  dutchingStakes,
  americanFromDecimal
} from "../lib/odds-tools.mjs";

test("parseOddsToken decimal e BR", () => {
  assert.equal(parseOddsToken("2.50").decimal, 2.5);
  assert.equal(parseOddsToken("2,50").decimal, 2.5);
});

test("parseOddsToken american", () => {
  assert.ok(Math.abs(parseOddsToken("+150").decimal - 2.5) < 0.001);
  assert.ok(Math.abs(parseOddsToken("-200").decimal - 1.5) < 0.001);
});

test("parseOddsToken fractional", () => {
  assert.ok(Math.abs(parseOddsToken("3/1").decimal - 4) < 0.001);
});

test("analyzeThreeWay margin e fair", () => {
  const r = analyzeThreeWay(2, 3.5, 3.5);
  assert.equal(r.ok, true);
  assert.ok(r.margin > 0);
  const sumFair = r.fair.H + r.fair.D + r.fair.A;
  assert.ok(Math.abs(sumFair - 1) < 1e-9);
});

test("expectedValueDecimal", () => {
  const ev = expectedValueDecimal(0.5, 2.2);
  assert.ok(ev != null && ev > 0);
});

test("dutchingStakes equilibra retorno 2 outcomes", () => {
  const d = dutchingStakes([2, 2], 100);
  assert.ok(d);
  assert.ok(Math.abs(d.stakes[0] - 50) < 0.01);
  assert.ok(Math.abs(d.roiIfAnyWins) < 0.01);
});

test("americanFromDecimal roundtrip aproximado", () => {
  const am = americanFromDecimal(2.5);
  assert.equal(am, 150);
});
