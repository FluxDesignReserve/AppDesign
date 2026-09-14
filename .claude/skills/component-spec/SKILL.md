---
name: component-spec
description: Author a design/engineering spec for a single UI component (button, input, card, modal, nav item, etc.). Use when the user asks for a "component spec", "design spec", "component documentation", "usage guidelines", or wants to document a component so designers and engineers can implement or consume it consistently. Produces one Markdown file per component covering definition, when to use / not use, variants, states, anatomy, Figma properties, usage rules, accessibility, and related atoms.
---

# Component Spec

A component spec is the contract between design and engineering for one component. It tells a reader what the component is, when to reach for it, how it is built, and how it behaves — enough to implement it, review it, or decide against it without opening Figma or the codebase.

Write one spec per component. If someone asks for "a spec for buttons and inputs", write two files.

## When to invoke this skill

- "Write a spec for the `<Button>` / `<Card>` / `<Modal>` component"
- "Document this component's usage rules"
- "Add design specs for the components in `src/components/…`"
- "I need Figma-style component documentation"

## When NOT to invoke this skill

- The request is for a full **design system** overview (multiple components, tokens, principles) — write a system doc instead, and link out to per-component specs from there.
- The request is for **implementation code** rather than a document — build the component; don't write a spec unless asked.
- The request is for a **page or flow spec** (multiple components composed) — that's a page spec, not a component spec.
- The component doesn't exist yet and the user hasn't described its behavior — ask before inventing one.

## How to write the spec

1. **Identify the component.** Confirm the exact name (`Button`, not `PrimaryButton`) and, if it exists in the repo, read its source before writing. Never invent variants, props, or states the code doesn't have — verify or ask.
2. **Pick one output file** at `docs/components/<ComponentName>.md` (or wherever the project already keeps component docs — check first). Use PascalCase for the filename.
3. **Fill every section below in order.** If a section genuinely doesn't apply (e.g. a purely static component has no interactive states), keep the heading and write `_None — this component is non-interactive._` rather than deleting it. Consistent structure across specs is the point.
4. **Be concrete.** No "flexible", "modern", "clean". Name the tokens, the pixel values, the aria roles, the keys. If a value isn't decided, mark it `TBD` — don't guess.
5. **Bullets over prose** for lists (variants, states, rules). Prose is fine for definitions and rationale.
6. **Show, don't just tell** — when a rule has a visual counterpart, add a one-line example (`✅ Primary button for the single most important action on a screen` / `❌ Two primary buttons in the same view`).

## Required sections (in this order)

Use these headings exactly. They map to the fields designers expect in Figma component documentation, so an engineer and a designer reading the same spec see the same shape.

### 1. What it is
One sentence. The component's role in the system, not its appearance. "A `Button` triggers an action or navigates the user; it is the primary way a user commits to something in the UI."

### 2. When to use it
2–6 bullets. Concrete scenarios, not categories. "Submitting a form", "Confirming a destructive action in a dialog", "Advancing a multi-step flow" — not "when you need a button".

### 3. When not to use it
2–6 bullets naming the **common misuses** you've seen or expect. Each bullet says what to reach for instead.
- `❌ For navigation between pages — use a `Link` so it behaves like a link (right-click, middle-click, copy URL).`
- `❌ For toggling a boolean state — use a `Switch` or `Checkbox`.`

### 4. Variants
List every variant with a one-line purpose. Group by axis if there is more than one (e.g. **Style**, **Size**).
```
Style
- Primary — the single most important action in a view.
- Secondary — supporting actions alongside a primary.
- Tertiary / Ghost — low-emphasis actions in dense UI.
- Danger — irreversible or destructive actions.

Size
- sm (28px) — dense tables, toolbars.
- md (36px) — default.
- lg (44px) — marketing, empty states, mobile CTAs.
```
If the component has one variant, say so: `_Single variant._`

### 5. States
List every interactive state the component can be in, with what triggers it and any visual change worth naming.
- **Default** — resting state.
- **Hover** — pointer over the target; raise background one step.
- **Focus-visible** — keyboard focus; 2px outline in `--focus-ring`.
- **Active / pressed** — pointer or space/enter down.
- **Disabled** — non-interactive; skipped in tab order; `aria-disabled="true"`.
- **Loading** — action pending; label swapped for a spinner; `aria-busy="true"`.
- **Selected / on** — for toggles.
- **Error / invalid** — for inputs.
Include only the states that apply. Non-interactive components: `_None — this component is non-interactive._`

### 6. Anatomy
Name every part of the component. Use the same names design and engineering will use forever — anatomy names are the vocabulary the rest of the spec is written in.
```
- Container — outer frame; owns padding, radius, background.
- Icon (leading) — optional; 16px; inherits label color.
- Label — the button text.
- Icon (trailing) — optional; 16px.
- Loading indicator — replaces the label region when loading.
```
A simple ASCII diagram is fine when it clarifies layout:
```
[ (icon)  Label  (icon) ]
```

### 7. Properties (Figma)
The properties exposed on the Figma component, in the order they appear in the panel. For each, give the type and options.
```
- Style       Variant   Primary | Secondary | Tertiary | Danger
- Size        Variant   sm | md | lg
- State       Variant   Default | Hover | Focus | Active | Disabled | Loading
- Label       Text      "Button"
- Icon L      Boolean   false
- Icon L ▸    Instance  swap → Icon set
- Icon T      Boolean   false
- Icon T ▸    Instance  swap → Icon set
- Full width  Boolean   false
```
Match the code prop names where the code exists — if `variant` in code is `intent` in Figma, that's a bug in the spec, not a feature.

### 8. Usage rules
Two short lists, `Do` and `Don't`. 3–6 items each. Concrete, not aspirational.
```
Do
✅ Use one primary button per view — the single most important action.
✅ Keep labels to 1–3 words; start with a verb ("Save changes", not "Changes saved").
✅ Pair a destructive Primary with a Secondary that cancels.

Don't
❌ Stack two primaries side-by-side.
❌ Put a Button inside a link, or a Link styled as a Button — pick one.
❌ Use `Danger` for anything reversible.
```

### 9. Accessibility notes
Cover **keyboard**, **screen reader**, and **visible focus** at minimum. Reference WCAG success criteria only when they add information ("contrast ≥ 4.5:1 per WCAG 1.4.3"). Name the actual roles, keys, and aria attributes.
```
Keyboard
- Focusable in tab order (unless disabled).
- `Enter` and `Space` activate.
- `Escape` in a dialog dismisses the dialog, not the button.

Screen reader
- Native `<button>` — role announced automatically.
- Icon-only buttons must set `aria-label`.
- Loading state sets `aria-busy="true"`; label change is announced via `aria-live="polite"` region if the label itself changes.

Focus
- Visible focus ring on `:focus-visible`; never suppressed globally.
- Contrast of focus ring ≥ 3:1 against every background the button sits on.
```

### 10. Related atom components
Link to the smaller components this one composes, and to the sibling components it's often confused with. One line each; link with a repo-relative path if the sibling spec exists.
```
Composed of
- `Icon` — leading / trailing slots.
- `Spinner` — loading state.

Often confused with
- `Link` — for navigation; behaves like an anchor.
- `IconButton` — icon-only; different min-hit-target rules.
- `MenuItem` — inside a menu; different keyboard model.
```
If the component is a true atom with no sub-parts and no near-siblings, say so: `_None._`

## Output format

- One `.md` file per component.
- H1 is the component name (`# Button`).
- Sections are H2 in the order above.
- Wrap at ~100 columns so diffs stay reviewable.
- No emojis except `✅` / `❌` inside the Usage rules list — keep everything else plain.

## Verification before you finish

Read the spec back and check:
1. Every variant, state and property matches the code, or is explicitly marked `TBD`.
2. `When not to use it` names concrete alternatives, not just prohibitions.
3. Accessibility covers keyboard, screen reader, and visible focus.
4. No section is silently missing — every heading is present, even if the body is `_None._`.
5. The file lives where other component docs live (or `docs/components/` if none do).
