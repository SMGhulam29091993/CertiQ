import type {
  AnalystAnswer,
  GuardrailVerdict,
  IOutputGuardrail,
  MetricResult,
  OutputGuardrailInput,
} from '@certiq/contracts';

type Figure = AnalystAnswer['figures'][number];

/** How a prose number was written — decides which figure units it may be compared against. */
type ProseKind = 'usd' | 'percent' | 'hours' | 'plain';

interface ProseNumber {
  readonly raw: string;
  /** Digits as written, before any K/M/B scale (so "$670K" → 670). */
  readonly mantissa: number;
  readonly decimals: number;
  readonly scale: number;
  readonly kind: ProseKind;
}

const USER_MESSAGE = 'I couldn’t verify every number against a certified metric, so I’m not showing an answer.';

/**
 * Rounding in prose ("$670K" for 670138.48) is accepted only while the rounded number stays
 * this close to the figure. Without the cap, "$1M" would "round" from 670K and pass.
 */
const ROUNDING_MAX_RELATIVE_ERROR = 0.05;

// Month names are matched case-sensitively so the modal verb "may" is never mistaken for a date.
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

/**
 * Tokens stripped from prose before number extraction. Each one is a label for *when* or *which*,
 * not a quantity, so it cannot leak a metric value. Kept deliberately short: every ignore rule is
 * a hole a leaked number could slip through.
 */
const NON_QUANTITY_TOKENS: readonly RegExp[] = [
  // ISO dates / timestamps — the query's time_range is routinely echoed back to the user.
  /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g,
  // Slash dates (05/01, 5/1/2026).
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
  // "May 1", "May 1st", "May 1," — lookahead stops "May 12%" (nonsense, but fail closed) being eaten.
  new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?![\\d.%])\\b`, 'g'),
  // "1 May", "1st of May".
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`, 'g'),
  // Fiscal periods: Q3, H1, FY2026 / FY26.
  /\b(?:Q[1-4]|H[12]|FY\d{2,4})\b/g,
  // Metric / registry versions ("1.0.0") are cited in prose for auditability; three-part dotted
  // numbers are not a valid amount in any unit we format.
  /\b\d+\.\d+\.\d+\b/g,
  // Ordinals rank rather than quantify ("the 2nd-highest state").
  /\b\d+(?:st|nd|rd|th)\b/g,
];

/**
 * Amount with optional currency, sign, thousands separators, decimals and unit/scale suffix.
 * The lookbehind skips digits glued to identifiers ("T04", "v2", "UT05") — those are names.
 */
const PROSE_NUMBER =
  /(?<![\p{L}\p{N}_.])(?:[-−]\s?)?(\$\s?)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:\s*(%|percent\b|pct\b|thousand\b|million\b|billion\b|[kKmMbB]\b|hours?\b|hrs?\b|h\b))?/gu;

/**
 * AC3–AC5: every figure must be grounded in non-suppressed evidence, and every number in the
 * summary prose must be one of those figures. Deterministic — no LLM (Guardrail Invariant 1).
 */
export class NumericGroundingGuardrail implements IOutputGuardrail {
  readonly id = 'output.numeric_grounding';
  readonly stage = 'output' as const;

  constructor(private readonly relativeTolerance = 0.005) {}

  async check(input: OutputGuardrailInput): Promise<GuardrailVerdict<OutputGuardrailInput>> {
    const { answer, evidence } = input;
    // Refusals and clarifications carry no certified figures; grounding them would only block
    // a safe response.
    if (answer.status !== 'answered') return { action: 'allow' };

    const problems: string[] = [];

    for (const figure of answer.figures) {
      if (!this.isGrounded(figure, evidence)) {
        problems.push(`figure "${figure.label}"=${figure.value} (${figure.metricId}@${figure.metricVersion}) not in non-suppressed evidence`);
      }
    }

    const ungroundedProse = extractProseNumbers(answer.summary).filter((n) => !this.proseMatchesAnyFigure(n, answer.figures));
    if (ungroundedProse.length > 0) {
      problems.push(`summary numbers not among figures: ${ungroundedProse.map((n) => JSON.stringify(n.raw)).join(', ')}`);
    }

    if (problems.length === 0) return { action: 'allow' };
    return { action: 'block', reason: problems.join('; '), userMessage: USER_MESSAGE };
  }

  private isGrounded(figure: Figure, evidence: readonly MetricResult[]): boolean {
    if (!Number.isFinite(figure.value)) return false;
    return evidence
      .filter((r) => r.metricId === figure.metricId && r.metricVersion === figure.metricVersion)
      .some((result) => {
        // Invariant 5: a suppressed row grounds nothing — neither alone nor inside a total.
        // Checking both flags because suppression nulls the value but a stale value must not count.
        const visible = result.rows
          .filter((row) => !row.suppressed && row.value !== null)
          .map((row) => row.value as number);
        if (visible.some((v) => this.close(figure.value, v))) return true;
        if (visible.length === 0) return false;
        const total = visible.reduce((a, b) => a + b, 0);
        return this.close(figure.value, total);
      });
  }

  private proseMatchesAnyFigure(n: ProseNumber, figures: readonly Figure[]): boolean {
    return figures.some((f) => targetsFor(n.kind, f).some((t) => this.proseMatches(n, t)));
  }

  /**
   * Compared on absolute value because prose states direction in words ("down 4.2%") while the
   * figure carries the sign.
   */
  private proseMatches(n: ProseNumber, target: number): boolean {
    const t = Math.abs(target) / n.scale;
    if (this.close(n.mantissa, t)) return true;
    if (t === 0) return false;
    const roundsTo = Math.abs(t - n.mantissa) <= 0.5 * 10 ** -n.decimals + 1e-9;
    return roundsTo && Math.abs(t - n.mantissa) / t <= ROUNDING_MAX_RELATIVE_ERROR;
  }

  private close(actual: number, expected: number): boolean {
    // Relative tolerance is meaningless at zero (any non-zero actual fails by infinity, and
    // 0 * tol = 0 makes it exact anyway); use a tiny absolute epsilon for float noise.
    if (expected === 0) return Math.abs(actual) <= 1e-9;
    return Math.abs(actual - expected) <= this.relativeTolerance * Math.abs(expected);
  }
}

/** Which figure values a prose number may legitimately be a rendering of. */
function targetsFor(kind: ProseKind, f: Figure): number[] {
  switch (kind) {
    // A ratio may be stored as 0.123 or (by a sloppy model) as 12.3; both render as "12.3%".
    case 'percent':
      return f.unit === 'ratio' ? [f.value * 100, f.value] : [];
    case 'usd':
      return f.unit === 'usd' ? [f.value] : [];
    case 'hours':
      return f.unit === 'hours' ? [f.value] : [];
    // A bare number is unit-ambiguous, so it may be any figure's raw value — but never a
    // ratio scaled to percent, which would let "12.3" pass for a 0.123 rate without a % sign.
    case 'plain':
      return [f.value];
  }
}

function extractProseNumbers(summary: string): ProseNumber[] {
  let text = summary;
  for (const re of NON_QUANTITY_TOKENS) text = text.replace(re, ' ');

  const out: ProseNumber[] = [];
  for (const m of text.matchAll(PROSE_NUMBER)) {
    const [raw, dollar, digits = '', rawSuffix] = m;
    const suffix = rawSuffix?.toLowerCase();
    const plainDigits = digits.replace(/,/g, '');
    const decimals = plainDigits.includes('.') ? (plainDigits.split('.')[1]?.length ?? 0) : 0;

    // A bare 4-digit integer in calendar range is a year ("in 2026"). Anything with a unit,
    // currency, separator or decimals is an amount and stays checked.
    if (!dollar && !suffix && /^\d{4}$/.test(digits)) {
      const year = Number(digits);
      if (year >= 1900 && year <= 2100) continue;
    }

    const kind: ProseKind = dollar
      ? 'usd'
      : suffix === '%' || suffix === 'percent' || suffix === 'pct'
        ? 'percent'
        : suffix !== undefined && /^(hours?|hrs?|h)$/.test(suffix)
          ? 'hours'
          : 'plain';

    out.push({ raw: raw.trim(), mantissa: Number(plainDigits), decimals, scale: scaleOf(suffix), kind });
  }
  return out;
}

function scaleOf(suffix: string | undefined): number {
  switch (suffix) {
    case 'k':
    case 'thousand':
      return 1e3;
    case 'm':
    case 'million':
      return 1e6;
    case 'b':
    case 'billion':
      return 1e9;
    default:
      return 1;
  }
}
