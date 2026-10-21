# Nova on Carbon

A rebuild of the Nova hiring prototype on IBM's [Carbon Design System](https://carbondesignsystem.com)
(`@carbon/react`, g10 theme). The aim is a calm, minimal UI: less on screen at once,
categories behind dropdowns, muted colour, and one obvious next step per page.

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

| Area | Before | After |
| --- | --- | --- |
| Navigation | 6 tabs with badges, workspace switcher, search, "New", avatar | 4 tabs, with Preboarding and Analytics under **More**; notifications and profile |
| Home | Mascot, greeting, 4 prompt chips, "Browse prompts", 3 dashboard cards, footer links | Greeting, one ask box whose suggestions sit in its dropdown, top 3 things that need you |
| Jobs | Cards with 3 stat boxes, AI-match bars, warnings, Nova banner and tips | One table; status (Open, Draft, On hold, Closed) in a dropdown; slow roles flagged inline |
| Candidates | Stage tabs, role select, 6 match chips, talent pool, view toggles, Nova banner, column and export controls | Stage, role and match dropdowns; search; table with bulk actions and pagination |
| Interviews | Status tabs, week strip, Sophia bar, Nova tip, policy note | Status dropdown, one table, feedback in a modal with Nova's draft prefilled |
| Approvals | Tabs, policy note, large cards with 3 fact boxes, approver avatars, Nova tip | Status dropdown, compact cards: what, why, approve or ask for changes |
| Preboarding | 5 sub-tabs, 3 audience filters, 4 status filters, mood column | One "show" dropdown and a table: start date, readiness, risk, nudge |
| Analytics | 4 KPIs, 3 period tabs, 3 data-source tabs, 6 charts with captions | 3 KPIs and one chart at a time, picked from a **Breakdown** dropdown, each with a one-line takeaway |
| Colour | Brand blue plus green, teal, orange, red and purple for status | Carbon greys, one blue for actions; colour only where it carries meaning (P0, high risk, waits over 7 days) |

## Loading

Follows Carbon's [loading guidelines](https://carbondesignsystem.com/components/loading/usage/):

- **Loading** (overlay) once, while the app starts.
- **Skeletons** (`DataTableSkeleton`, `SkeletonText`, `SkeletonPlaceholder`) shaped like the content while a page loads.
- **InlineLoading** for actions that wait on the server: asking Nova, approving, saving in modals.

## Nielsen's 10 heuristics

1. **Visibility of system status.** Skeletons and inline loading for every wait. A toast confirms every action. The notification badge, the home list and dropdown counts update as you clear work.
2. **Match with the real world.** Plain recruiter language ("Waiting on you", "In stage", "Expected CTC"). Dates read as "Today", "Tomorrow" or "Sun, 18 Oct".
3. **User control and freedom.** Every action that changes data (move, reject, approve, ask for changes, sign feedback, new job) offers **Undo**. Modals always have Cancel. New jobs start as private drafts.
4. **Consistency and standards.** Every page has the same shape: title, one-line summary, one primary button top right, filter dropdowns, then a table or cards. Carbon components are used throughout.
5. **Error prevention.** Primary buttons stay disabled until input is valid. Bulk actions appear only after you select rows. "Reject" is marked as a destructive action and set apart in the menu.
6. **Recognition rather than recall.** Filters show their current value and count, e.g. "Screening (95)". Ask Nova's suggestions are one click away in its dropdown. Jobs link straight to their filtered candidates.
7. **Flexibility and efficiency.** Bulk move and reject, sortable columns, search, and deep links (`#/candidates`, etc.).
8. **Aesthetic and minimalist design.** Banners, tips, mascot, decorative stats and duplicate entry points are gone. Each page shows only what supports its main task.
9. **Help users recover from errors.** Inline validation says what to fix ("Add a job title."). Empty states say why a list is empty ("No one matches these filters.").
10. **Help and documentation.** Short helper text where a field needs it, e.g. "One per line, or separated by commas", and a one-line note on Nova's drafted feedback.
