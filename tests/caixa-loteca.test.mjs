import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCaixaLotecaUrl,
  golsToLotecaSymbol,
  resultSymbolsFromCaixaPayload,
  formatOfficialResultInput,
  CAIXA_LOTECA_API_BASE
} from "../lib/caixa-loteca.mjs";

test("buildCaixaLotecaUrl ultimo ou por numero", () => {
  assert.equal(buildCaixaLotecaUrl(""), CAIXA_LOTECA_API_BASE);
  assert.equal(buildCaixaLotecaUrl(null), CAIXA_LOTECA_API_BASE);
  assert.equal(
    buildCaixaLotecaUrl(1242),
    `${CAIXA_LOTECA_API_BASE}/1242`
  );
});

test("golsToLotecaSymbol H D A", () => {
  assert.equal(golsToLotecaSymbol(2, 0), "H");
  assert.equal(golsToLotecaSymbol(1, 2), "A");
  assert.equal(golsToLotecaSymbol(0, 0), "D");
  assert.equal(golsToLotecaSymbol(3, 3), "D");
  assert.equal(golsToLotecaSymbol(undefined, 1), null);
});

test("resultSymbolsFromCaixaPayload extrai 14 placares", () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({
    nuSequencial: i + 1,
    nuGolEquipeUm: i % 3 === 0 ? 1 : 0,
    nuGolEquipeDois: i % 3 === 1 ? 1 : 0
  }));
  const out = resultSymbolsFromCaixaPayload({
    numero: 99,
    dataApuracao: "01/01/2026",
    listaResultadoEquipeEsportiva: rows
  });
  assert.equal(out.ok, true);
  assert.equal(out.symbols.length, 14);
  assert.equal(out.numero, 99);
  assert.equal(out.dataApuracao, "01/01/2026");
});

test("formatOfficialResultInput", () => {
  assert.equal(
    formatOfficialResultInput(["H", "D", "A", "H"]),
    "H D A H"
  );
});
