// Uganda statutory payroll calculations (28 August 2026). Pure functions —
// no database access — so a payroll run and any future preview/estimate can
// share exactly one rule set.
//
// Figures reflect the Income Tax Act (as amended) monthly PAYE bands and the
// National Social Security Fund Act contribution rates in force for the
// 2025/26 year. They are the demo's best-effort statutory model, not tax
// advice; a deployment confirms the current thresholds with URA / NSSF.

const NSSF_EMPLOYEE_RATE = 0.05; // 5% of gross, withheld from the employee
const NSSF_EMPLOYER_RATE = 0.1; // 10% of gross, paid by the employer

// Monthly PAYE bands (UGX). Each entry: [lower bound inclusive, marginal rate].
// Tax on a band applies to the portion of gross above its lower bound and up
// to the next band's lower bound.
const PAYE_BANDS: Array<{ from: number; rate: number }> = [
  { from: 0, rate: 0 },
  { from: 235_000, rate: 0.1 },
  { from: 335_000, rate: 0.2 },
  { from: 410_000, rate: 0.3 },
];
// Additional 10% levied on the portion of gross above this threshold.
const HIGH_EARNER_THRESHOLD = 10_000_000;
const HIGH_EARNER_ADDITIONAL_RATE = 0.1;

const round = (n: number) => Math.round(n);

/** Monthly PAYE on a gross monthly pay figure (UGX). */
export function computePaye(gross: number): number {
  if (!gross || gross <= PAYE_BANDS[1].from) return 0;
  let tax = 0;
  for (let i = 1; i < PAYE_BANDS.length; i++) {
    const bandFrom = PAYE_BANDS[i].from;
    const bandTo = i + 1 < PAYE_BANDS.length ? PAYE_BANDS[i + 1].from : Infinity;
    if (gross <= bandFrom) break;
    const taxableInBand = Math.min(gross, bandTo) - bandFrom;
    tax += taxableInBand * PAYE_BANDS[i].rate;
  }
  if (gross > HIGH_EARNER_THRESHOLD) {
    tax += (gross - HIGH_EARNER_THRESHOLD) * HIGH_EARNER_ADDITIONAL_RATE;
  }
  return round(tax);
}

/** NSSF contributions on a gross monthly pay figure (UGX). */
export function computeNssf(gross: number): { employee: number; employer: number } {
  const g = gross && gross > 0 ? gross : 0;
  return {
    employee: round(g * NSSF_EMPLOYEE_RATE),
    employer: round(g * NSSF_EMPLOYER_RATE),
  };
}

export interface PayComponents {
  gross: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  advanceRecovery: number;
  otherDeductions: number;
  net: number;
}

/**
 * Full pay breakdown for one employee for one month. `advanceRecovery` and
 * `otherDeductions` are supplied by the caller (the payroll run works out the
 * advance instalment); net pay is gross less PAYE, the employee NSSF share,
 * the advance instalment and any other deductions.
 */
export function computePay(
  gross: number,
  opts: { advanceRecovery?: number; otherDeductions?: number } = {},
): PayComponents {
  const paye = computePaye(gross);
  const nssf = computeNssf(gross);
  const advanceRecovery = round(opts.advanceRecovery ?? 0);
  const otherDeductions = round(opts.otherDeductions ?? 0);
  const net = round(gross - paye - nssf.employee - advanceRecovery - otherDeductions);
  return {
    gross: round(gross),
    paye,
    nssfEmployee: nssf.employee,
    nssfEmployer: nssf.employer,
    advanceRecovery,
    otherDeductions,
    net,
  };
}
