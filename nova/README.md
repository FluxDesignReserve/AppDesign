# Nova

A calmer version of the Nova hiring prototype, restyled in an Intercom-like product UI.
Every element stays where the original put it: the top bar (logo, workspace, centred pill
nav, search, notifications, **+ New**, avatar), page headers, tab rows, the job card grid,
approval cards, the interview week strip, the analytics grid and the floating Nova button
at bottom left. What changes is how much each of them shows at once.

The components are small and hand-written (`src/ui.tsx`, `src/styles.css`), with icons from
`lucide-react`. There is no third-party component library.

The candidate data (413 people across 5 roles) was captured from the original prototype,
so counts and names match it.

## Running

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # -> dist/
npm run build:single   # -> dist-single/index.html, one file that opens straight off disk
```

`dist-single/index.html` is committed, so the prototype can be opened without installing anything.

## What changed

Same layout, less to read. Long chip rows became dropdowns; short tab rows stay as tabs.

| Area | Original | Now |
| --- | --- | --- |
| Top bar | Same items, blue badges | Same items and order; badges in neutral grey; search opens a "Go to" palette (Ctrl K) |
| Nova | Mascot plus a tip card that pops up on every page | Smaller orb on Home; tips stay behind the bottom-left Nova button until you click it |
| Home | 4 prompt chips, "Browse prompts", 3 large dashboard cards | 2 prompt chips plus **More**; "Needs you" as one list of the top 3, **See all** opens notifications |
| Jobs | Cards with 3 stat boxes, AI-match bar, warning line, publish badge; Careers page, Summarise, Filters, view toggle | Same cards with one stats row, owner and **Review**; one **New job** button |
| Candidates | Stage tabs; 7 match chips; talent pool, referrals, by-role/person, list/board, columns, export; Nova banner | Same stage tabs; **Role**, **Match** and **Sort** dropdowns, a "Waiting > 7d" toggle, search |
| Interviews | Tabs, blind-feedback note, panel avatars, Meet and draft chips, week strip, Sophia bar | Same tabs and week strip (click a day to filter); one row per panel |
| Preboarding | 5 sub-tabs, 3 audience tabs, status dropdown, Team and Mood columns | **Show** dropdown, search, joiner table, **Add joiner** |
| Analytics | 3 data-source tabs, 4 KPIs, 6 charts | Same 4 KPIs; funnel on the left, the other breakdowns in one card on the right with a dropdown |
| Approvals | Cards with fact boxes, links, approver chain, "Add a note"; policy note | Same 2-column cards: what, facts, who asked and why, **Approve** / **Ask for changes** |

## Loading

- A spinner once, while the app starts.
- Shimmer skeletons shaped like the content while a page loads.
- An inline spinner on any action that waits on the server: asking Nova, approving, saving, nudging.

## Nielsen's 10 heuristics

1. **Visibility of system status.** Skeletons and inline loading for every wait. A toast confirms every action. The notification badge, the home list and dropdown counts update as you clear work.
2. **Match with the real world.** Plain recruiter language ("Waiting on you", "In stage", "Expected CTC"). Dates read as "Today", "Tomorrow" or "Sun, 18 Oct".
3. **User control and freedom.** Every action that changes data (move, reject, approve, ask for changes, sign feedback, new job) offers **Undo**. Modals always have Cancel. New jobs start as private drafts.
4. **Consistency and standards.** Every page keeps the original shape: eyebrow, title, one-line summary, one primary button top right, tabs, then content. The same tab row, pill dropdown, table, button and modal are used everywhere.
5. **Error prevention.** Primary buttons stay disabled until input is valid. Bulk actions appear only after you select rows. "Reject" is styled in red so it is not mistaken for a safe action.
6. **Recognition rather than recall.** Filters show their current value and count, e.g. "Screening (95)". Ask Nova's suggestions are one click away in its dropdown. Jobs link straight to their filtered candidates.
7. **Flexibility and efficiency.** Bulk move and reject, keyboard-driven dropdowns and suggestions, a sort dropdown, search, and deep links (`#/candidates`, etc.).
8. **Aesthetic and minimalist design.** Banners and pop-up tips are gone, duplicate controls are cut, and each card shows only what supports its main action. Positions are unchanged, so nothing has to be relearned.
9. **Help users recover from errors.** Inline validation says what to fix ("Add a job title."). Empty states say why a list is empty ("No one matches these filters.").
10. **Help and documentation.** Short helper text where a field needs it, e.g. "One per line, or separated by commas", and a one-line note on Nova's drafted feedback.
