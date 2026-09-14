# Button

## What it is
A single interactive element the user taps or clicks to trigger a single, immediate action.

## When to use it
- To submit a form ("Save," "Create account").
- To trigger a one-step, immediate action ("Delete," "Copy link," "Add to cart").
- As the primary or secondary call to action in a dialog, card, or empty state.
- To open something that requires an explicit, deliberate trigger (e.g. "Upload file" opens a
  file picker).

## When not to use it
- Don't use it to navigate to another page or view — use a **Link** instead; a Button that
  navigates breaks the browser's back/forward and open-in-new-tab expectations.
- Don't use it for a binary on/off setting — use a **Switch** instead.
- Don't use it for choosing one option among several mutually exclusive options — use **Radio
  Group** or **Segmented Control** instead.
- Don't use it as a purely decorative or non-interactive element — if nothing happens on
  activation, it isn't a button.
- Don't stack more than one primary-emphasis Button in the same view — it forces the user to
  guess which action actually matters; demote the rest to Secondary or Ghost.

## Variants
| Variant | Purpose |
|---|---|
| Primary | The single highest-emphasis action in a given view (e.g. "Save"). At most one per view. |
| Secondary | A supporting action alongside a Primary button (e.g. "Cancel" next to "Save"). |
| Ghost | A low-emphasis action that shouldn't visually compete with Primary/Secondary, often repeated inline (e.g. row actions in a table). |
| Destructive | An action with an irreversible or hard-to-reverse effect (e.g. "Delete account"). Always paired with a confirmation step. |

Sizes: **Small**, **Medium**, **Large** — chosen for information density and touch-target needs of
the surface the button sits in, not for visual emphasis.

## States
| State | Trigger | Notes |
|---|---|---|
| Default | — | |
| Hover | Pointer over the button | Desktop/pointer input only; has no meaning on touch. |
| Focus-visible | Keyboard focus lands on the button | Must remain visible; never suppress the focus ring. |
| Active / Pressed | Pointer down or `Space`/`Enter` held | |
| Disabled | Action is currently unavailable | Not focusable, not announced as a button by screen readers. Prefer explaining *why* nearby rather than only disabling. |
| Loading | The triggered action is in flight | Button stays focused and in the tab order; label typically swaps for a spinner. Must not be dismissible mid-action if the action isn't idempotent. |

## Anatomy
1. **Container** — the clickable hit area; carries background, border, and corner radius per variant.
2. **Leading icon** (optional) — reinforces the action's meaning at a glance; never the sole content unless labeled via `aria-label`.
3. **Label** — the action's name, always a verb or verb phrase ("Save," not "Saving" as the default state).
4. **Trailing icon** (optional) — used for directional or disclosure meaning (e.g. external-link, chevron).
5. **Loading indicator** (state-only) — replaces or overlays the label while `Loading` is active.

## Properties
| Property | Type | Values |
|---|---|---|
| Variant | Variant | Primary, Secondary, Ghost, Destructive |
| Size | Variant | Small, Medium, Large |
| State | Variant | Default, Hover, Focus, Pressed, Disabled, Loading |
| Has leading icon | Boolean | true, false |
| Has trailing icon | Boolean | true, false |
| Icon | Instance-swap | Any icon component |
| Label | Text | Free text |

## Usage rules
### Do
- Start the label with a verb that names the exact action ("Delete file," not "OK").
- Keep labels to 1–3 words; move explanation to surrounding copy, not the button itself.
- Use exactly one Primary button per view/section so the main action is unambiguous.
- Show a Loading state for any action that takes long enough to be perceptible (~300ms+).

### Don't
- Don't rely on color alone to convey Destructive — pair it with a confirming word ("Delete") and,
  for irreversible actions, a confirmation step.
- Don't put two conflicting actions ("Save" and "Discard") at equal visual emphasis.
- Don't use vague labels like "Submit," "Click here," or "OK" when a specific verb is available.
- Don't disable a button without also communicating why, when the reason isn't obvious from context.

## Accessibility notes

**Pattern:** [WAI-ARIA APG — Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)

### Keyboard
| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Moves focus to/from the button in document order. |
| `Enter` | Activates the button. |
| `Space` | Activates the button on key-up (standard native-button behavior). |

### Screen reader
- Exposed with role `button`.
- Accessible name comes from the visible Label; if the button is icon-only, it must have an
  `aria-label` or visually-hidden text — an icon alone has no accessible name.
- `Disabled` buttons are announced as "dimmed"/unavailable and are removed from the tab order —
  don't rely on a disabled button alone to communicate *why* an action is unavailable.
- `Loading` should be announced via an `aria-live="polite"` region (or `aria-busy="true"` on the
  button) so screen reader users know the action is in progress without needing to re-focus it.

### Other
- Minimum touch target 44×44px (iOS HIG) / 48×48dp (Material) even if the visible Small button is
  smaller — pad the hit area, don't shrink it below the visible size.
- Text/icon contrast must meet WCAG AA (4.5:1 for text, 3:1 for large text/icons) against the
  button's background in every variant, including Disabled where feasible.

## Related atom components
- **Icon** — used for leading/trailing icons and icon-only buttons.
- **Spinner** — used for the Loading state's indicator.
- **Icon Button** — the icon-only sibling of Button; use it instead of an icon-only Button variant.
- **Link** — the correct choice when the action is navigation rather than an in-place effect.
