import { useState } from 'react';
import { Button, ComboBox, ContainedList, ContainedListItem, InlineLoading, Link, SkeletonText, Tile } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import type { NavProps } from '../App';
import type { Notice, Page } from '../data/model';
import { settle, usePageLoad } from '../ui';

interface Answer {
  text: string;
  page?: Page;
  cta?: string;
}

// Suggestions live in the ask box's dropdown instead of as a wall of chips.
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

const FALLBACK: Answer = {
  text: 'I can answer questions about your jobs, candidates, interviews and approvals. Pick a suggestion to see how.',
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home({ go, notices }: NavProps & { notices: Notice[] }) {
  const loading = usePageLoad(300);
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const ask = async (q = query) => {
    if (!q.trim()) return;
    setAnswer(null);
    setAsking(true);
    await settle(900);
    setAsking(false);
    setAnswer(ANSWERS[q.trim()] ?? FALLBACK);
  };

  return (
    <div className="nova-home">
      <h1>{greeting()}, Vedank.</h1>

      <form
        className="nova-ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <ComboBox
          id="ask"
          titleText="Ask Nova"
          placeholder="Ask about your hiring, or pick a suggestion"
          size="lg"
          items={Object.keys(ANSWERS)}
          allowCustomValue
          onInputChange={(text) => setQuery(text ?? '')}
          onChange={({ selectedItem }) => {
            if (selectedItem) {
              setQuery(selectedItem);
              ask(selectedItem);
            }
          }}
        />
        <Button type="submit" size="lg" hasIconOnly renderIcon={ArrowRight} iconDescription="Ask" disabled={!query.trim() || asking} />
      </form>

      <div className="nova-answer" aria-live="polite">
        {asking && <InlineLoading description="Nova is thinking…" />}
        {answer && (
          <Tile>
            <p>{answer.text}</p>
            {answer.page && (
              <Link href={`#/${answer.page}`} renderIcon={ArrowRight} onClick={(e) => (e.preventDefault(), go(answer.page!))}>
                {answer.cta}
              </Link>
            )}
          </Tile>
        )}
      </div>

      <section className="nova-needs">
      {loading ? (
        <SkeletonText paragraph lineCount={3} />
      ) : (
        <ContainedList label={`Needs you · top 3 of ${notices.length}`} kind="on-page" size="lg">
          {notices.slice(0, 3).map((n) => (
            <ContainedListItem key={n.id} onClick={() => go(n.page)}>
              <span className="nova-list-item">
                <span>
                  <strong>{n.title}</strong>
                  <span className="nova-secondary">{n.detail}</span>
                </span>
                <ArrowRight size={16} aria-hidden />
              </span>
            </ContainedListItem>
          ))}
        </ContainedList>
      )}
      </section>
    </div>
  );
}
