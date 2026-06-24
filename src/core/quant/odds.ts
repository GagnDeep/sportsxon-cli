/**
 * Odds / probability conversions. Internally everything is a probability in
 * [0,1]. Prediction-market contracts are quoted in cents (1–99¢) = probability.
 */

export function clampProb(p: number): number {
  return Math.min(1, Math.max(0, p));
}

export function centsToProb(cents: number): number {
  return clampProb(cents / 100);
}

export function probToCents(p: number): number {
  return Math.round(clampProb(p) * 100);
}

export function decimalToProb(decimal: number): number {
  return decimal > 0 ? clampProb(1 / decimal) : 0;
}

export function probToDecimal(p: number): number {
  const c = clampProb(p);
  return c > 0 ? 1 / c : Infinity;
}

export function americanToProb(american: number): number {
  if (american === 0) return 0;
  return american > 0
    ? clampProb(100 / (american + 100))
    : clampProb(-american / (-american + 100));
}

export function probToAmerican(p: number): number {
  const c = clampProb(p);
  if (c <= 0 || c >= 1) return 0;
  return c > 0.5 ? -Math.round((c / (1 - c)) * 100) : Math.round(((1 - c) / c) * 100);
}

export interface OddsView {
  probability: number; // 0..1
  cents: number; // 1..99
  decimal: number;
  american: number;
}

/** Build every representation from a single probability. */
export function oddsView(p: number): OddsView {
  const probability = clampProb(p);
  return {
    probability,
    cents: probToCents(probability),
    decimal: Number(probToDecimal(probability).toFixed(4)),
    american: probToAmerican(probability),
  };
}
