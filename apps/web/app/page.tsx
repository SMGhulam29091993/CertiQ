import { AskConsole } from '../components/ask-console';

export default function Page() {
  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◆
          </span>
          <span className="brand-name">CertiQ</span>
        </div>
        <p className="tagline">Business answers from certified metrics only. If it isn’t certified, it says so.</p>
      </header>
      <AskConsole />
    </main>
  );
}
