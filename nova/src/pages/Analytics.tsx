import { useState } from 'react';
import type { NavProps } from '../App';
import { Download } from 'lucide-react';
import { Button, PageHeader, Select, Skeleton, usePageLoad, useToast } from '../ui';

interface Breakdown {
  label: string;
  /** One sentence: the thing worth knowing. */
  insight: string;
  unit?: string;
  bars: { label: string; value: number; note?: string }[];
  /** Index of the bar the insight is about. */
  focus: number;
}

const BREAKDOWNS: Breakdown[] = [
  {
    label: 'Stage conversion',
    insight: 'Interview → Offer keeps only 26%, the steepest drop.',
    bars: [
      { label: 'Sourced', value: 416 },
      { label: 'Screening', value: 145, note: '35%' },
      { label: 'Interview', value: 50, note: '34%' },
      { label: 'Offer', value: 13, note: '26%' },
      { label: 'Preboarding', value: 10, note: '77%' },
      { label: 'Hired', value: 3, note: '30%' },
    ],
    focus: 3,
  },
  {
    label: 'Time in stage',
    insight: 'Business Development Representative is slowest, at a median 5 days.',
    unit: 'd',
    bars: [
      { label: 'BDR', value: 5 },
      { label: 'AI Product Manager', value: 5 },
      { label: 'Renewals Manager', value: 4 },
      { label: 'Account Manager', value: 4 },
      { label: 'AE · APAC & EMEA', value: 4 },
    ],
    focus: 0,
  },
  {
    label: 'Source',
    insight: 'The careers page brings the most people: 40% of the pipeline.',
    bars: [
      { label: 'Careers page', value: 166 },
      { label: 'Bulk import', value: 107 },
      { label: 'Referrals', value: 66 },
      { label: 'WhatsApp', value: 41 },
      { label: 'Recruiter', value: 33 },
    ],
    focus: 0,
  },
  {
    label: 'Recruiter load',
    insight: 'Manmeet Kumar carries 38% of the pipeline, 5× the lightest load.',
    bars: [
      { label: 'Manmeet Kumar', value: 157 },
      { label: 'Aliya Akhtar', value: 143 },
      { label: 'Himanshi Tomer', value: 82 },
      { label: 'Mimansa Mehta', value: 31 },
    ],
    focus: 0,
  },
];

const KPIS = [
  { label: 'Time to hire', value: '34d', note: 'Median of 3 hires' },
  { label: 'Offer acceptance', value: '75%', note: '3 of 4 offers accepted' },
  { label: 'Active pipeline', value: '413', note: 'Across 5 open roles' },
  { label: 'Roles needing attention', value: '5', note: 'Worst: Account Manager, 47 waiting' },
];

// The funnel keeps its own card on the left, as in the original. The other breakdowns share
// the card on the right, switched with a dropdown instead of four more charts.
const [FUNNEL, ...OTHERS] = BREAKDOWNS;

function Bars({ breakdown }: { breakdown: Breakdown }) {
  const max = Math.max(...breakdown.bars.map((b) => b.value));
  return (
    <>
      <h2>{breakdown.insight}</h2>
      {breakdown.bars.map((b, i) => (
        <div key={b.label} className="bar">
          <span>{b.label}</span>
          <div className="bar-track" role="presentation">
            <div className={`bar-fill${i === breakdown.focus ? ' bar-fill--focus' : ''}`} style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="bar-value num">
            {b.value}
            {breakdown.unit ?? ''}
            {b.note && <span className="muted"> · {b.note}</span>}
          </span>
        </div>
      ))}
    </>
  );
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Skeleton w="60%" h={14} />
      {[90, 40, 20, 10].map((w) => (
        <Skeleton key={w} w={`${w}%`} h={8} />
      ))}
    </div>
  );
}

export function Analytics(_: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [label, setLabel] = useState(OTHERS[0].label);
  const other = OTHERS.find((b) => b.label === label)!;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        subtitle="3 hires in the last 30 days · median 34 days to hire"
        action={
          <div className="page-actions">
            <Button onClick={() => toast({ title: 'Export started', subtitle: "We'll email you the CSV." })}>
              <Download size={15} /> Export
            </Button>
            <span className="select-trigger" style={{ cursor: 'default' }}>
              <span className="label">Range:</span> <strong>Last 30 days</strong>
            </span>
          </div>
        }
      />

      <div className="kpis">
        {KPIS.map((k) => (
          <div key={k.label} className="card kpi">
            <span>{k.label}</span>
            {loading ? <Skeleton w={72} h={28} /> : <strong className="num">{k.value}</strong>}
            <span>{k.note}</span>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <figure className="card chart" style={{ margin: 0 }} aria-label={FUNNEL.label}>
          <div className="chart-head">
            <span className="eyebrow">Reached each stage</span>
          </div>
          {loading ? <ChartSkeleton /> : <Bars breakdown={FUNNEL} />}
        </figure>
        <figure className="card chart" style={{ margin: 0 }} aria-label={other.label}>
          <div className="chart-head">
            <span className="eyebrow">Breakdown</span>
            <Select label="By" align="end" value={label} options={OTHERS.map((b) => ({ value: b.label }))} onChange={setLabel} />
          </div>
          {loading ? <ChartSkeleton /> : <Bars breakdown={other} />}
        </figure>
      </div>
    </div>
  );
}
