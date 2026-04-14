/**
 * Ferramentas de odds (conversao, probabilidade implicita, devig, dutching).
 * Calculos locais — sem cotacoes ao vivo.
 */

/** @param {number} d */
export function impliedGrossFromDecimal(d) {
  if (!(typeof d === "number" && Number.isFinite(d) && d >= 1.0001)) return null;
  return 1 / d;
}

/**
 * @param {number} american - ex.: +220 ou -180
 * @returns {number|null} decimal europeu
 */
export function decimalFromAmerican(american) {
  if (!Number.isFinite(american) || american === 0) return null;
  if (american > 0) return american / 100 + 1;
  return 100 / -american + 1;
}

/**
 * @param {number} num
 * @param {number} den - > 0
 */
export function decimalFromFractional(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den + 1;
}

/**
 * Aceita decimal (2.5 ou 2,5), americana (+150), fracao UK (3/1, 5/2).
 * @param {string} raw
 * @returns {{ decimal: number, format: string } | { error: string }}
 */
export function parseOddsToken(raw) {
  const s = String(raw).trim().replace(/\s+/g, "");
  if (!s) return { error: "vazio" };

  const fr = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fr) {
    const num = Number(fr[1]);
    const den = Number(fr[2]);
    const d = decimalFromFractional(num, den);
    return d != null && d >= 1.0001 ? { decimal: d, format: "fractional" } : { error: "fracao invalida" };
  }

  if (/^[+-]\d{2,}$/.test(s)) {
    const v = Number(s);
    const d = decimalFromAmerican(v);
    return d != null ? { decimal: d, format: "american" } : { error: "american invalida" };
  }

  const decStr = s.replace(",", ".");
  if (/^\d+[.]?\d*$/.test(decStr)) {
    const n = Number(decStr);
    if (!Number.isFinite(n)) return { error: "numero invalido" };
    if (n >= 1.0001 && n < 1000) return { decimal: n, format: "decimal" };
  }

  return { error: "formato nao reconhecido" };
}

/** @param {number} d - decimal */
export function americanFromDecimal(d) {
  if (!(typeof d === "number" && d >= 1.0001)) return null;
  if (d >= 2) return Math.round((d - 1) * 100);
  return Math.round(-100 / (d - 1));
}

/** Fracao simplificada aproximada */
export function fractionalDisplayFromDecimal(d) {
  if (!(typeof d === "number" && d >= 1.0001)) return null;
  const net = d - 1;
  const maxDen = 20;
  let best = "1/1";
  let bestErr = Infinity;
  for (let den = 1; den <= maxDen; den += 1) {
    const num = Math.round(net * den);
    if (num <= 0) continue;
    const err = Math.abs(num / den - net);
    if (err < bestErr) {
      bestErr = err;
      const g = gcd(num, den);
      best = `${num / g}/${den / g}`;
    }
  }
  return best;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Remove margem (devig proporcional — metodo multiplicativo).
 * @param {number[]} impliedGross - [pH, pD, pA] somando > 1 em geral
 */
export function devigProportional(impliedGross) {
  const sum = impliedGross.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  return impliedGross.map((p) => p / sum);
}

/**
 * Analise 1x2 com tres odds decimais.
 */
export function analyzeThreeWay(h, d, a) {
  const ih = impliedGrossFromDecimal(h);
  const id = impliedGrossFromDecimal(d);
  const ia = impliedGrossFromDecimal(a);
  if (ih == null || id == null || ia == null) return { ok: false, reason: "Odds invalidas (use decimal >= 1.01)." };
  const sum = ih + id + ia;
  const margin = sum - 1;
  const fair = devigProportional([ih, id, ia]);
  return {
    ok: true,
    implied: { H: ih, D: id, A: ia },
    impliedPct: { H: ih * 100, D: id * 100, A: ia * 100 },
    margin,
    marginPct: margin * 100,
    fair: fair ? { H: fair[0], D: fair[1], A: fair[2] } : null,
    fairPct: fair
      ? { H: fair[0] * 100, D: fair[1] * 100, A: fair[2] * 100 }
      : null
  };
}

/** EV = p * (decimal - 1) - (1 - p) = p * decimal - 1 */
export function expectedValueDecimal(fairProb, decimalOdds) {
  if (!(fairProb > 0 && fairProb < 1 && decimalOdds >= 1)) return null;
  return fairProb * decimalOdds - 1;
}

/**
 * Dutching: distribuir banca total entre selecoes mutuamente exclusivas.
 * stake_i = T * (1/o_i) / sum_j(1/o_j)
 * @param {number[]} decimalOdds
 * @param {number} totalStake
 */
export function dutchingStakes(decimalOdds, totalStake) {
  if (!Array.isArray(decimalOdds) || decimalOdds.length < 2) return null;
  const inv = decimalOdds.map((o) => (o >= 1.0001 ? 1 / o : NaN));
  if (inv.some((x) => !Number.isFinite(x))) return null;
  const s = inv.reduce((a, b) => a + b, 0);
  if (!(s > 0)) return null;
  const stakes = inv.map((w) => (totalStake * w) / s);
  const ret = stakes[0] * decimalOdds[0];
  return { stakes, impliedReturn: ret, roiIfAnyWins: ret - totalStake };
}
