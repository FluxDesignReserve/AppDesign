import { useRef, useState } from 'react';
import { ArrowRight, ArrowUp, CalendarClock, CheckCircle2, ChevronRight, Phone, Sparkles } from 'lucide-react';
import type { NavProps } from '../App';
import type { Notice, Page } from '../data/model';
import { Button, InlineLoading, Skeleton, settle, usePageLoad } from '../ui';

interface Answer {
  text: string;
  page?: Page;
  cta?: string;
}

// Suggestions open from the ask box instead of sitting on the page as a wall of chips.
const ANSWERS: Record<string, Answer> = {
  'Which jobs are at risk?': {
    text: 'Account Manager is most at risk: 47 people have waited more than 7 days. AI Product Manager is next, with 40.',
    page: 'jobs',
    cta: 'Open jobs',
  },
  'What feedback do I owe?': {
    text: 'One scorecard: Tanvi Yadav, first interview. Nova drafted it from the recording, so you only need to check and sign it.',
    page: 'interviews',
    cta: 'Write feedback',
  },
  'Where are we losing candidates?': {
    text: 'Between interview and offer. Only 26% move on, the steepest drop in the pipeline.',
    page: 'analytics',
    cta: 'See analytics',
  },
  'Draft a post for Account Manager': {
    text: 'Draft ready: "We\'re hiring an Account Manager in Noida to own EMEA and US renewals." It goes out only after you approve it.',
  },
};

const SUGGESTIONS = Object.keys(ANSWERS);

const FALLBACK: Answer = {
  text: 'I can answer questions about your jobs, candidates, interviews and approvals. Pick a suggestion to see how.',
};

const ICONS: Partial<Record<Page, typeof Phone>> = {
  approvals: CheckCircle2,
  interviews: CalendarClock,
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home({ go, notices }: NavProps & { notices: Notice[] }) {
  const loading = usePageLoad(300);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()));

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setOpen(false);
    setAnswer(null);
    setAsking(true);
    await settle(900);
    setAsking(false);
    setAnswer(ANSWERS[q.trim()] ?? FALLBACK);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, -1));
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') ask(open && active >= 0 ? matches[active] : query);
    else return;
    e.preventDefault();
  };

  const top = notices.slice(0, 3);

  return (
    <div className="home">
      <h1>{greeting()}, Vedank</h1>
      <p>Ask Nova about your hiring, or start with what needs you.</p>

      <div className="ask">
        <div className="ask-box">
          <Sparkles size={18} color="var(--text-3)" aria-hidden />
          <input
            ref={input}
            role="combobox"
            aria-label="Ask Nova"
            aria-expanded={open && matches.length > 0}
            aria-controls="suggestions"
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `suggestion-${active}` : undefined}
            placeholder="Ask anything, e.g. which jobs are at risk?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKey}
          />
          <Button variant="primary" icon aria-label="Ask" disabled={!query.trim() || asking} onClick={() => ask(query)}>
            <ArrowUp size={16} />
          </Button>
        </div>
        {open && matches.length > 0 && (
          <ul className="menu" role="listbox" id="suggestions" aria-label="Suggestions">
            {matches.map((s, i) => (
              <li
                key={s}
                id={`suggestion-${i}`}
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className="menu-item"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => ask(s)}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-live="polite">
        {asking && (
          <div className="card answer">
            <InlineLoading>Nova is thinking…</InlineLoading>
          </div>
        )}
        {answer && (
          <div className="card answer">
            <Sparkles size={16} color="var(--accent)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />
            <div>
              <p>{answer.text}</p>
              {answer.page && (
                <a
                  href={`#/${answer.page}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(answer.page!);
                  }}
                >
                  {answer.cta} <ArrowRight size={13} style={{ verticalAlign: -2 }} aria-hidden />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="section-title">
        Needs you
        <span>
          {top.length} of {notices.length}
        </span>
      </div>
      <div className="card">
        {loading ? (
          <div className="skeleton-rows">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-row">
                <Skeleton w={32} h={32} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  <Skeleton w="40%" />
                  <Skeleton w="60%" h={10} />
                </div>
              </div>
            ))}
          </div>
        ) : top.length === 0 ? (
          <div className="empty">You're all caught up.</div>
        ) : (
          <ul className="list">
            {top.map((n) => {
              const Icon = ICONS[n.page] ?? Phone;
              return (
                <li key={n.id}>
                  <button className="list-item" onClick={() => go(n.page)}>
                    <span className="icon-tile" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className="grow">
                      <b>{n.title}</b>
                      <span className="sub">{n.detail}</span>
                    </span>
                    <ChevronRight size={16} className="chev" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
