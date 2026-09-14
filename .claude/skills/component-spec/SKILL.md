---
name: component-spec
description: Write a design-system spec for a single UI component — the reference doc that lives next to the Figma library and the code, telling designers and engineers what the component is, when to use it, its variants, states, anatomy, Figma properties, usage rules, accessibility behavior, and the atoms it composes. Use whenever the user asks to "spec", "document", "write guidelines for", or "write usage docs for" a component (Button, Input, Toast, Card, Modal, Menu, Tabs, Avatar, Badge, Tooltip, …); when they want the README for a new component they just built in Figma or in code; or when they want to bring an undocumented component up to library standard. Not for page-level flows, product PRDs, or brand style guides — this is one component per document.
---

# Component / design spec

Produce one Markdown document per component, in this exact section order, using the exact headings below. Every section is required — if a section genuinely does not apply (e.g. an icon-only atom with no variants), keep the heading and write one line explaining why, rather than deleting it. Missing sections silently are the failure mode; empty-with-a-reason is fine.

Save to `docs/components/<component-name>.md` unless the user names a different location. Filename is kebab-case singular (`button.md`, not `buttons.md`).

## How to gather the material

Before writing, get the facts. In order:

1. **Ask the user** for anything you cannot see: the component's name, where it lives in Figma (file / page / frame), whether code already exists, and which atoms it is built from. One batched question is fine; don't fill in blanks by guessing.
2. **Read the Figma source** with the Figma MCP tools when a link or selection is available — `mcp__Figma__get_metadata`, `mcp__Figma__get_design_context`, `mcp__Figma__get_variable_defs`, `mcp__Figma__get_screenshot`. The variant/property list in the spec must match the component's Figma properties exactly (same names, same option order).
3. **Read the code** when it exists — the component's source file plus one or two call sites. Props in code and properties in Figma should line up; call out mismatches in the spec rather than papering over them.
4. **Check neighbors.** Skim sibling specs in the same folder so headings, tone, and terminology stay consistent across the library.

If a fact is unknown after the above, write `TBD — <what's missing and who owns it>` in place. Don't invent behavior.

## The template

```markdown
# <Component name>

## What it is
<One sentence. Names the component and the single job it does. No marketing language, no list of features.>

## When to use it
- <Concrete scenario — the situation, not the component. "User needs to confirm a destructive action they can't undo.">
- <Another concrete scenario.>
- <Keep to the 3–6 situations that actually recur. If there is only one, list one.>

## When not to use it
- <Specific misuse, and what to use instead. "For non-blocking feedback after a save — use Toast, not Modal.">
- <Another misuse, with the correct alternative named.>
- <Cover the confusions you have actually seen or expect. Not a generic "don't overuse".>

## Variants
<One row per variant. Variant = a distinct visual/functional treatment surfaced as a Figma variant property (usually `Variant` or `Type`). List every option shipped in the library.>

- **<Variant name>** — <what it is for; the decision rule that picks it over the others>.
- **<Variant name>** — <…>.

## States
<Every interactive state the component can be in, including the ones designers forget. List each once, even if it looks visually identical to another — the behavior differs.>

- **Default** — <resting appearance>.
- **Hover** — <pointer over, no press>.
- **Focus-visible** — <keyboard focus ring; describe the ring>.
- **Active / Pressed** — <mouse down or key down>.
- **Disabled** — <non-interactive; note pointer-events and aria-disabled behavior>.
- **Loading** — <if the component can be async>.
- **Selected / Checked** — <if it can carry state>.
- **Error** — <if it validates>.
- **Read-only** — <if it can be locked but still focusable>.

## Anatomy
<Name every visible part. These names are the vocabulary the rest of the team uses in reviews and in code — pick them carefully and reuse them across the library.>

- **Container** — <the outer bounding element>.
- **<Part name>** — <role of this part, e.g. "Leading icon — optional glyph before the label; 16×16, inherits label color">.
- **<Part name>** — <…>.

An ASCII sketch or an embedded screenshot with numbered callouts is welcome when the anatomy is not obvious from names alone.

## Properties
<Every Figma property on the component, in the exact order Figma lists them. Match names and option casing 1:1 — designers filter by these strings.>

| Property | Type | Options / Default | Notes |
| --- | --- | --- | --- |
| `Variant` | Variant | Primary (default), Secondary, Ghost, Destructive | Maps to code prop `variant`. |
| `Size` | Variant | S, M (default), L | |
| `Leading icon` | Boolean | false (default) | Shows the Leading icon slot. |
| `Label` | Text | "Button" | |
| `State` | Variant | Default, Hover, Focus, Pressed, Disabled | Preview only; runtime state is not controlled from Figma. |

If code props diverge from Figma properties, add a "Code prop mapping" subsection below the table and list the differences.

## Usage rules
**Do**
- <Concrete rule tied to a real scenario. "Do lead a destructive Button with the action verb — 'Delete file', not 'Yes'.">
- <…>

**Don't**
- <Concrete anti-pattern, with the reason. "Don't stack two Primary Buttons in one row — only one action per surface should read as primary.">
- <…>

Keep rules behavioral, not stylistic — spacing and color live in tokens, not here.

## Accessibility
- **Role / semantics** — <native element or ARIA role, e.g. "Renders as `<button type=\"button\">`; never a `<div>` with `onClick`">.
- **Keyboard** — <every key the component responds to and what it does. Tab / Shift+Tab for focus; Enter and Space to activate; Arrow keys for internal navigation if compound; Escape to dismiss if dismissible.>
- **Screen reader** — <what is announced. Accessible name source (visible label, `aria-label`, `aria-labelledby`), state announcements (pressed, expanded, checked, busy), and any live-region behavior.>
- **Focus** — <where focus lands on open, where it returns on close, whether focus is trapped>.
- **Contrast & sizing** — <minimum hit target (44×44 for touch), contrast ratio the tokens must clear (4.5:1 text, 3:1 non-text), reduced-motion behavior if animated>.

## Related atoms
<The smaller components this one composes. Link to their specs. If this component IS an atom, say so and leave the list empty.>

- [Icon](./icon.md) — used in the Leading icon and Trailing icon slots.
- [Spinner](./spinner.md) — shown in the Loading state.
```

## Writing rules

- **One component per file.** A Button spec does not also cover IconButton — that's a separate file that links back.
- **Present tense, describing the shipped component.** Not "we will add…" or "eventually…". If it isn't built, it isn't in the spec — put it in a `## Roadmap` section at the end or leave it out.
- **Show, don't restate tokens.** Say "uses `--color-danger-bg`", not "is red (#D93025)". The token file is the source of truth for values.
- **Every "don't" names the correct alternative.** A prohibition without a replacement is useless to the reader.
- **No screenshots of production data.** If you embed images, use library artboards or synthetic content.
- **Link, don't duplicate.** Accessibility patterns shared across many components (focus ring recipe, motion tokens) live in one shared doc — link to it from each spec.

## Before you hand it off

Skim your own draft against this checklist. Fix, don't just note:

- [ ] Every heading from the template is present, in order.
- [ ] Variants and Properties match Figma exactly (names, casing, order, defaults).
- [ ] Every state the component can enter is listed — including Disabled, Focus-visible, and Loading if applicable.
- [ ] Each Do/Don't is specific to this component, not generic advice.
- [ ] Accessibility covers role, keyboard, screen reader, and focus movement.
- [ ] Related atoms link to real files (or the section explains why there are none).
- [ ] No `TBD` remains without an owner named next to it.
