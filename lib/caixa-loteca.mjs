/** API JSON oficial da Caixa (Portal de Loterias). */
export const CAIXA_LOTECA_API_BASE =
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca";

/**
 * Monta a URL do último concurso ou de um número específico.
 * @param {number | "" | null | undefined} numeroConcurso
 */
export function buildCaixaLotecaUrl(numeroConcurso) {
  const n = Number(numeroConcurso);
  if (Number.isInteger(n) && n > 0) {
    return `${CAIXA_LOTECA_API_BASE}/${n}`;
  }
  return CAIXA_LOTECA_API_BASE;
}

/**
 * Converte gols (coluna 1 x coluna 2) para H / D / A da Loteca.
 * @param {unknown} golsCasa
 * @param {unknown} golsFora
 * @returns {"H" | "D" | "A" | null}
 */
export function golsToLotecaSymbol(golsCasa, golsFora) {
  const h = Number(golsCasa);
  const a = Number(golsFora);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return "H";
  if (h < a) return "A";
  return "D";
}

/**
 * Interpreta o JSON retornado pela API da Caixa e devolve os 14 símbolos oficiais.
 * @param {unknown} payload
 * @returns {{ ok: true, symbols: string[], numero: number | null, dataApuracao: string | null } | { ok: false, reason: string }}
 */
export function resultSymbolsFromCaixaPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "JSON invalido ou vazio." };
  }
  const list = payload.listaResultadoEquipeEsportiva;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, reason: "Resposta sem listaResultadoEquipeEsportiva." };
  }
  const sorted = [...list].sort(
    (a, b) => (Number(a.nuSequencial) || 0) - (Number(b.nuSequencial) || 0)
  );
  if (sorted.length !== 14) {
    return {
      ok: false,
      reason: `Esperados 14 jogos na lista; recebido ${sorted.length}.`
    };
  }
  const symbols = [];
  for (let i = 0; i < 14; i += 1) {
    const row = sorted[i];
    const sym = golsToLotecaSymbol(row.nuGolEquipeUm, row.nuGolEquipeDois);
    if (!sym) {
      return {
        ok: false,
        reason: `Jogo ${i + 1}: placar incompleto ou invalido na API.`
      };
    }
    symbols.push(sym);
  }
  const numero =
    typeof payload.numero === "number" && Number.isFinite(payload.numero)
      ? payload.numero
      : null;
  const dataApuracao =
    typeof payload.dataApuracao === "string" ? payload.dataApuracao : null;
  return { ok: true, symbols, numero, dataApuracao };
}

/**
 * Formata os 14 símbolos para o campo de texto (espaços entre letras).
 * @param {string[]} symbols
 */
export function formatOfficialResultInput(symbols) {
  return symbols.join(" ");
}
