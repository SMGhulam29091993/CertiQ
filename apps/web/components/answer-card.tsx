import type { AskResponse, MetricResult } from '@certiq/contracts';
import { formatCost, formatValue } from '../lib/format';

const STATUS: Record<AskResponse['status'], { label: string; tone: string }> = {
  answered: { label: 'Answered', tone: 'ok' },
  refused: { label: 'Not certified', tone: 'warn' },
  needs_clarification: { label: 'Needs clarification', tone: 'info' },
  blocked: { label: 'Blocked by guardrail', tone: 'stop' },
  error: { label: 'Error', tone: 'stop' },
};

export function AnswerCard({ response }: { response: AskResponse }) {
  const s = STATUS[response.status];
  const { answer, audit, evidence, trace } = response;

  return (
    <article className={`card tone-${s.tone}`}>
      <header className="card-head">
        <span className={`badge badge-${s.tone}`}>{s.label}</span>
        {audit && (
          <span className={`badge ${audit.pass ? 'badge-ok' : 'badge-stop'}`}>
            {audit.pass ? 'Audit passed' : 'Audit failed'}
          </span>
        )}
      </header>

      {answer?.figures && answer.figures.length > 0 && (
        <div className="figures">
          {answer.figures.map((f, i) => (
            <div key={`${f.metricId}-${i}`} className="figure">
              <span className="figure-value">{formatValue(f.value, f.unit)}</span>
              <span className="figure-label">
                {f.label}
                {f.period ? ` · ${f.period}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="summary">{answer?.summary ?? response.userMessage}</p>

      {answer?.clarifyingQuestion && <p className="callout">{answer.clarifyingQuestion}</p>}

      {answer?.suggestedMetrics && answer.suggestedMetrics.length > 0 && (
        <p className="callout">
          Closest certified metrics:{' '}
          {answer.suggestedMetrics.map((m) => (
            <code key={m}>{m}</code>
          ))}
        </p>
      )}

      {response.blockedBy && (
        <p className="callout">
          Stopped by <code>{response.blockedBy.guardrail}</code>
        </p>
      )}

      {audit && audit.issues.length > 0 && (
        <ul className="issues">
          {audit.issues.map((iss, i) => (
            <li key={i} className={`issue-${iss.severity}`}>
              <strong>{iss.severity}</strong> {iss.message}
            </li>
          ))}
        </ul>
      )}

      {evidence.map((e) => (
        <Evidence key={`${e.metricId}-${e.executedAt}`} result={e} />
      ))}

      <footer className="card-foot">
        <div className="chips">
          {response.guardrailsApplied.map((g) => (
            <span key={g} className="mini-chip">
              {g}
            </span>
          ))}
        </div>
        <span className="trace">
          {trace.llmCalls} LLM · {trace.toolCalls} tool · {(trace.inputTokens + trace.outputTokens).toLocaleString()} tok ·{' '}
          {formatCost(trace.costUsd)} · {(trace.durationMs / 1000).toFixed(1)}s
        </span>
      </footer>
    </article>
  );
}

function Evidence({ result }: { result: MetricResult }) {
  const dims = result.query.dimensions;
  return (
    <details className="evidence">
      <summary>
        How this was computed · <code>{result.metricId}</code> v{result.metricVersion}
        {result.suppressedRows > 0 && <span className="supp"> · {result.suppressedRows} suppressed</span>}
      </summary>
      <table>
        <thead>
          <tr>
            {result.query.grain && <th>Period</th>}
            {dims.map((d) => (
              <th key={d}>{d}</th>
            ))}
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className={r.suppressed ? 'row-supp' : undefined}>
              {result.query.grain && <td>{r.period}</td>}
              {dims.map((d) => (
                <td key={d}>{r.dimensions[d]}</td>
              ))}
              <td className="num">{formatValue(r.value, result.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <pre className="sql">{result.sql}</pre>
      <p className="params">params: {JSON.stringify(result.params)}</p>
    </details>
  );
}
