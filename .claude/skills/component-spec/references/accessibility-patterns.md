# WAI-ARIA APG patterns by component type

Use this to ground the Accessibility notes section instead of writing generic advice. Each row
gives the canonical pattern name, its core role(s), and the keyboard model to describe. Full
pattern details: https://www.w3.org/WAI/ARIA/apg/patterns/

| Component type | APG pattern | Core role(s) | Keyboard model |
|---|---|---|---|
| Button | Button | `button` | `Enter` activates; `Space` activates on key-up. |
| Toggle button (e.g. bold/italic, favorite) | Button (with `aria-pressed`) | `button`, `aria-pressed` | Same as Button; state exposed via `aria-pressed="true/false"`. |
| Checkbox | Checkbox | `checkbox` | `Space` toggles checked/unchecked (and indeterminate → checked). |
| Radio group | Radio Group | `radiogroup` / `radio` | Arrow keys move selection between radios in the group (roving tabindex — only the selected radio is in the Tab order); `Space` selects the focused radio. |
| Switch | Switch | `switch` | `Space` (and often `Enter`) toggles on/off. |
| Tabs | Tabs | `tablist` / `tab` / `tabpanel` | Arrow keys move between tabs (roving tabindex); `Home`/`End` jump to first/last tab; selected tab's panel is exposed via `aria-controls`. Activation can be automatic (on arrow move) or manual (`Enter`/`Space` after arrowing) — state which one. |
| Dialog / Modal | Dialog (Modal) | `dialog` with `aria-modal="true"` | Focus moves into the dialog on open (usually to the first focusable element or the dialog itself) and is trapped inside it; `Escape` closes it; focus returns to the triggering element on close. |
| Non-modal panel/drawer | Dialog (Non-modal) | `dialog` | Same as Dialog but background remains operable; focus is not trapped. |
| Dropdown / Select | Listbox (or native `<select>`) | `combobox` + `listbox`/`option`, or `button` + `listbox` | `Enter`/`Space`/`Down Arrow` opens; Arrow keys move the highlighted option; `Enter` commits; `Escape` closes without changing selection; typing a letter jumps to a matching option. |
| Combobox (typeahead/autocomplete) | Combobox | `combobox`, `listbox`, `option` | Typing filters the list; `Down`/`Up` move into and through suggestions; `Enter` selects the highlighted suggestion; `Escape` closes the popup. |
| Tooltip | Tooltip | `tooltip` | Appears on focus or hover (not click); dismissible with `Escape`; never contains interactive content. |
| Accordion | Accordion | `button` (header) + region | `Enter`/`Space` on the header toggles its panel; headers are usually in normal Tab order (not roving); one or multiple panels may be open depending on design. |
| Menu (action menu, not navigation) | Menu / Menu Button | `menu`, `menuitem`, `button` (trigger) | `Enter`/`Space`/`Down Arrow` on the trigger opens the menu; Arrow keys move between items (roving tabindex); `Enter`/`Space` activates an item; `Escape` closes and returns focus to the trigger. |
| Slider | Slider | `slider` | `Left`/`Right` or `Down`/`Up` adjust value by a step; `Home`/`End` jump to min/max; `Page Up`/`Page Down` for larger steps where applicable. |
| Alert / inline validation message | Alert | `alert` (or `role="status"` for less urgent messages) | Not focusable itself; announced automatically via the live region when it appears — don't require the user to navigate to it to hear it. |
| Progress indicator | — (no interactive pattern) | `progressbar` | Not keyboard-operable; expose `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, or `aria-busy` for indeterminate progress. |
| Link | Link | `a` / `link` | `Enter` activates; navigates, doesn't trigger in-place effects. |
| Table with sortable columns | Table (Grid if cells are interactive) | `table`/`grid` | Grid: arrow keys move a single roving focus cell-to-cell. Plain sortable table: sort controls are just Buttons in each header cell. |

## Notes that apply across most patterns

- **Roving tabindex** means only one item in a composite widget (radio group, tablist, menu) is
  ever in the page's Tab order at a time; arrow keys move focus *within* the widget, and Tab moves
  focus *out of* the whole widget, not to the next item inside it. Call this out explicitly when
  describing keyboard behavior for such a component — it's the detail people most often get wrong.
- **Focus-visible, not just focus** — describe the focus indicator as required on keyboard
  interaction; don't say a component "shows a focus state on click," since a mouse click usually
  shouldn't show one (`:focus-visible` behavior).
- **Live regions** (`aria-live="polite"` or `"assertive"`, or role `status`/`alert`) are how a
  screen reader announces a state change that isn't itself receiving focus — loading states,
  validation errors, toast notifications. Say which politeness level applies and why.
- **Accessible name** — always state where the accessible name comes from (visible label text,
  `aria-label`, `aria-labelledby`, or placeholder as a last resort) since this is the single most
  common accessibility gap in custom components.
