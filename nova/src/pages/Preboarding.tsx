import { useState } from 'react';
import {
  Button,
  DataTableSkeleton,
  Dropdown,
  ProgressBar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import type { NavProps } from '../App';
import { JOINERS, dateIn, type Joiner, type Risk } from '../data/model';
import { PageHeader, settle, usePageLoad, useToast } from '../ui';

const VIEWS = ['Everyone', 'Needs attention'] as const;
type View = (typeof VIEWS)[number];

const RISK_TAG: Record<Risk, 'gray' | 'warm-gray' | 'red'> = { Low: 'gray', Medium: 'warm-gray', High: 'red' };

export function Preboarding(_: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [view, setView] = useState<View>('Everyone');
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  const attention = JOINERS.filter((j) => j.risk === 'High' || j.issue);
  const visible = view === 'Everyone' ? JOINERS : attention;

  const nudge = async (j: Joiner) => {
    setNudging(j.id);
    await settle();
    setNudging(null);
    setNudged((s) => new Set(s).add(j.id));
    toast({ title: `Nudged ${j.name}`, subtitle: 'Sent on WhatsApp and email.' });
  };

  return (
    <div className="nova-page">
      <PageHeader title="Preboarding" subtitle={`${JOINERS.length} joiners · next starts ${dateIn(JOINERS[0].startsIn)}`} />

      <div className="nova-filters">
        <Dropdown
          id="joiner-view"
          titleText="Show"
          label="Show"
          items={[...VIEWS]}
          itemToString={(v) => (v ? `${v} (${v === 'Everyone' ? JOINERS.length : attention.length})` : '')}
          selectedItem={view}
          onChange={({ selectedItem }) => selectedItem && setView(selectedItem)}
        />
      </div>

      {loading ? (
        <DataTableSkeleton rowCount={7} columnCount={5} showHeader={false} showToolbar={false} />
      ) : (
        <TableContainer>
          <Table aria-label="Joiners">
            <TableHead>
              <TableRow>
                <TableHeader>Joiner</TableHeader>
                <TableHeader>Starts</TableHeader>
                <TableHeader>Readiness</TableHeader>
                <TableHeader>Risk</TableHeader>
                <TableHeader aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    {j.name}
                    <span className="nova-secondary">{j.issue ?? j.role}</span>
                  </TableCell>
                  <TableCell>
                    {dateIn(j.startsIn)}
                    <span className="nova-secondary">in {j.startsIn} days</span>
                  </TableCell>
                  <TableCell style={{ minWidth: '9rem' }}>
                    <ProgressBar label={`${j.name} readiness`} hideLabel value={j.progress} size="small" helperText={`${j.progress}%`} />
                  </TableCell>
                  <TableCell>
                    <Tag size="sm" type={RISK_TAG[j.risk]}>
                      {j.risk}
                    </Tag>
                  </TableCell>
                  <TableCell className="nova-end">
                    {j.progress < 100 && (
                      <Button kind="ghost" size="sm" disabled={nudging === j.id || nudged.has(j.id)} onClick={() => nudge(j)}>
                        {nudging === j.id ? 'Sending…' : nudged.has(j.id) ? 'Nudged' : 'Nudge'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
