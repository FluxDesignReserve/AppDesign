import { CANDIDATE_ROWS } from './candidates';

export const ROLES = [
  'Renewals Manager',
  'Account Manager',
  'Account Executive – APAC & EMEA',
  'Business Development Representative',
  'AI Product Manager',
] as const;

export const STAGES = ['Sourced', 'Screening', 'Interview', 'Offer', 'Preboarding', 'Hired'] as const;
export type Stage = (typeof STAGES)[number];

export type Band = 'Excellent' | 'Strong' | 'Good' | 'Low' | 'No match' | 'No CV yet';
export const BANDS: Band[] = ['Excellent', 'Strong', 'Good', 'Low', 'No match', 'No CV yet'];

export function bandOf(score: number | null): Band {
  if (score === null) return 'No CV yet';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Low';
  return 'No match';
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  stage: Stage;
  score: number | null;
  band: Band;
  notice: string;
  ctc: string | null;
  employer: string;
  days: number;
}

export const CANDIDATES: Candidate[] = CANDIDATE_ROWS.map(
  ([name, role, stage, score, notice, ctc, employer, days], i) => ({
    id: `c${i}`,
    name,
    role: ROLES[role],
    stage: stage as Stage,
    score,
    band: bandOf(score),
    notice,
    ctc,
    employer,
    days,
  }),
);

export const SLOW_DAYS = 7;

export type JobStatus = 'Open' | 'Draft' | 'On hold' | 'Closed';

export interface Job {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  status: JobStatus;
  location: string;
  openings: number;
  hired: number;
  owner: string | null;
  oldestWait: number;
}

export const JOBS: Job[] = [
  { id: 'LT-0022', title: ROLES[0], priority: 'P2', status: 'Open', location: 'Noida', openings: 1, hired: 0, owner: 'Himanshi Tomer', oldestWait: 10 },
  { id: 'LT-0021', title: ROLES[1], priority: 'P0', status: 'Open', location: 'Noida', openings: 3, hired: 0, owner: 'Vishali', oldestWait: 11 },
  { id: 'LT-0020', title: ROLES[2], priority: 'P0', status: 'Open', location: 'Noida', openings: 1, hired: 0, owner: null, oldestWait: 8 },
  { id: 'LT-0019', title: ROLES[3], priority: 'P0', status: 'Open', location: 'Noida', openings: 4, hired: 0, owner: 'Mimansa Mehta', oldestWait: 11 },
  { id: 'LT-0018', title: ROLES[4], priority: 'P0', status: 'Open', location: 'Noida', openings: 1, hired: 0, owner: null, oldestWait: 11 },
];

export type Decision = 'Feedback due' | 'Upcoming' | 'Done';

export interface Interview {
  id: string;
  candidate: string;
  role: string;
  round: string;
  /** Days from today, so the schedule always reads relative to now. */
  dayOffset: number;
  time: string;
  status: Decision;
  draftReady?: boolean;
}

export const INTERVIEWS: Interview[] = [
  { id: 'i1', candidate: 'Tanvi Yadav', role: ROLES[1], round: 'First interview', dayOffset: -3, time: '11:00 am', status: 'Feedback due', draftReady: true },
  { id: 'i2', candidate: 'Nikhil Gupta', role: ROLES[1], round: 'First interview', dayOffset: 0, time: '11:30 am', status: 'Upcoming' },
  { id: 'i3', candidate: 'Bhavya Menon', role: ROLES[2], round: 'Hiring manager round', dayOffset: 0, time: '4:00 pm', status: 'Upcoming' },
  { id: 'i4', candidate: 'Meera Gupta', role: ROLES[3], round: 'First interview', dayOffset: 1, time: '10:00 am', status: 'Upcoming' },
  { id: 'i5', candidate: 'Akash Yadav', role: ROLES[4], round: 'Final interview', dayOffset: 2, time: '2:30 pm', status: 'Upcoming' },
  { id: 'i6', candidate: 'Aditi Agarwal', role: ROLES[2], round: 'First interview', dayOffset: -2, time: '3:30 pm', status: 'Done' },
];

export type ApprovalState = 'Waiting on you' | 'You sent' | 'Decided';

export interface Approval {
  id: string;
  kind: 'Offer' | 'Headcount';
  title: string;
  facts: string[];
  requestedBy: string;
  note: string;
  age: string;
  state: ApprovalState;
}

export const APPROVALS: Approval[] = [
  {
    id: 'a1',
    kind: 'Offer',
    title: 'Sneha Iyer · Renewals Manager',
    facts: ['₹24 LPA fixed', 'Starts 18 Nov 2026'],
    requestedBy: 'Himanshi Tomer',
    note: 'Top of band. She has a competing offer closing Friday.',
    age: '1h ago',
    state: 'Waiting on you',
  },
  {
    id: 'a2',
    kind: 'Headcount',
    title: 'Account Manager · 3 → 4 positions',
    facts: ['Backfill, EMEA pod'],
    requestedBy: 'Vishali',
    note: 'Backfill for a resignation in the EMEA pod.',
    age: '18h ago',
    state: 'Waiting on you',
  },
  {
    id: 'a3',
    kind: 'Offer',
    title: 'Nisha Bansal · Account Executive – APAC & EMEA',
    facts: ['₹26 LPA fixed', 'Starts 1 Dec 2026'],
    requestedBy: 'You',
    note: 'Waiting on Bharat Singh.',
    age: '2d ago',
    state: 'You sent',
  },
  {
    id: 'a4',
    kind: 'Offer',
    title: 'Prachi Singh · Renewals Manager',
    facts: ['₹14 LPA fixed', 'Approved'],
    requestedBy: 'Himanshi Tomer',
    note: 'Approved by you and Bharat Singh.',
    age: '9d ago',
    state: 'Decided',
  },
];

export type Risk = 'Low' | 'Medium' | 'High';

export interface Joiner {
  id: string;
  name: string;
  role: string;
  /** Days until the joiner starts. */
  startsIn: number;
  progress: number;
  risk: Risk;
  issue?: string;
}

export const JOINERS: Joiner[] = [
  { id: 'j1', name: 'Prachi Singh', role: ROLES[0], startsIn: 5, progress: 92, risk: 'Low' },
  { id: 'j2', name: 'Aditi Yadav', role: ROLES[3], startsIn: 6, progress: 10, risk: 'High', issue: '4 documents missing' },
  { id: 'j3', name: 'Nandini Bhatt', role: ROLES[1], startsIn: 12, progress: 28, risk: 'High', issue: 'Low mood at last check-in' },
  { id: 'j4', name: 'Anjali Reddy', role: ROLES[1], startsIn: 19, progress: 100, risk: 'Low' },
  { id: 'j5', name: 'Farhan Malhotra', role: ROLES[2], startsIn: 26, progress: 55, risk: 'Medium' },
  { id: 'j6', name: 'Rahul Menon', role: ROLES[3], startsIn: 33, progress: 57, risk: 'Low' },
  { id: 'j7', name: 'Ishani Kulkarni', role: ROLES[4], startsIn: 47, progress: 10, risk: 'Medium', issue: 'No check-in yet' },
];

export type Page = 'home' | 'jobs' | 'candidates' | 'interviews' | 'approvals' | 'preboarding' | 'analytics';

export interface Notice {
  id: string;
  title: string;
  detail: string;
  page: Page;
}

/** Everything waiting on the user, most urgent first. */
export const NOTICES: Notice[] = [
  { id: 'n1', title: '2 approvals', detail: 'Offer for Sneha Iyer closes Friday', page: 'approvals' },
  { id: 'n2', title: 'Feedback due', detail: 'Tanvi Yadav · draft ready from recording', page: 'interviews' },
  { id: 'n3', title: '2 screening calls to confirm', detail: 'Booked by Sophia for Account Manager', page: 'interviews' },
  { id: 'n4', title: 'Joiner at risk', detail: 'Aditi Yadav starts in 6 days, 4 documents missing', page: 'preboarding' },
  { id: 'n5', title: '5 roles need attention', detail: 'Account Manager has 47 waiting over 7 days', page: 'jobs' },
  { id: 'n6', title: '5 WhatsApp chats', detail: 'Candidates asking for a person', page: 'candidates' },
  { id: 'n7', title: '3 posts to approve', detail: 'Welcome Nandini and 2 more', page: 'preboarding' },
  { id: 'n8', title: '3 bot replies to approve', detail: 'Drafted by Nova', page: 'home' },
];

export function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
