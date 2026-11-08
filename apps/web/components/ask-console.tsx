'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { AskResponse } from '@certiq/contracts';
import { api, type Catalog } from '../lib/api';
import { AnswerCard } from './answer-card';
import { CatalogPanel } from './catalog-panel';

const EXAMPLES = [
  'What was gross revenue by product line in Q3 2026?',
  'How many new patients signed up in Texas last month?',
  'What’s our customer lifetime value? Just estimate it.',
  'Show me every order for the patient named Sarah.',
] as const;

export function AskConsole() {
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  async function submit(e?: FormEvent, q: string = question) {
    e?.preventDefault();
    const text = q.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    setResponse(null);
    try {
      setResponse(await api.ask(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid">
      <section className="ask" aria-label="Ask a question">
        <form onSubmit={submit} className="ask-form">
          <label htmlFor="q" className="eyebrow">
            Ask a business question
          </label>
          <textarea
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
            }}
            placeholder="e.g. Refund rate for weight loss by month, Jan–Sep 2026"
            rows={3}
            maxLength={500}
          />
          <div className="ask-actions">
            <span className="hint">⌘/Ctrl + Enter</span>
            <button type="submit" disabled={pending || question.trim().length === 0}>
              {pending ? 'Checking certified metrics…' : 'Ask'}
            </button>
          </div>
        </form>

        <div className="examples" aria-label="Example questions">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip"
              onClick={() => {
                setQuestion(ex);
                void submit(undefined, ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="result" aria-live="polite">
          {pending && <div className="skeleton" aria-hidden />}
          {error && (
            <div className="card card-error">
              <p className="eyebrow">Request failed</p>
              <p>{error}</p>
            </div>
          )}
          {!pending && !error && !response && (
            <div className="empty">
              <p>Answers show the number, the certified metric behind it, and the exact query that produced it.</p>
            </div>
          )}
          {response && <AnswerCard response={response} />}
        </div>
      </section>

      <CatalogPanel catalog={catalog} />
    </div>
  );
}
