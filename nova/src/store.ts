import { useSyncExternalStore } from 'react';
import { APPROVALS, INTERVIEWS, NOTICES, type Approval, type Interview, type Notice } from './data/model';

// Shared so that what's waiting on the user (header badge, home, notifications) stays true
// as they work through it.
interface State {
  approvals: Approval[];
  interviews: Interview[];
}

let state: State = { approvals: APPROVALS, interviews: INTERVIEWS };
const listeners = new Set<() => void>();

export function update(fn: (s: State) => Partial<State>) {
  state = { ...state, ...fn(state) };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useStore = () => useSyncExternalStore(subscribe, () => state);

/** Static notices, with the approval and feedback ones rebuilt from live state. */
export function useNotices(): Notice[] {
  const { approvals, interviews } = useStore();
  const waiting = approvals.filter((a) => a.state === 'Waiting on you');
  const due = interviews.filter((i) => i.status === 'Feedback due');
  const live: Notice[] = [];
  if (waiting.length)
    live.push({
      id: 'n1',
      title: waiting.length === 1 ? '1 approval' : `${waiting.length} approvals`,
      detail: waiting[0].title,
      page: 'approvals',
    });
  if (due.length)
    live.push({
      id: 'n2',
      title: 'Feedback due',
      detail: `${due[0].candidate}${due[0].draftReady ? ' · draft ready from recording' : ''}`,
      page: 'interviews',
    });
  return [...live, ...NOTICES.filter((n) => n.id !== 'n1' && n.id !== 'n2')];
}
