---
name: component-spec
description: Write a design-system component specification (What it is, When to use it, When not to use it, Variants, States, Anatomy, Figma Properties, Usage rules, Accessibility notes, Related atoms) for a UI component from a Figma file/link or from a description. Use this whenever the user asks to "document a component," "write a component spec," "create design specs," "spec out this button/input/modal/etc.," add documentation to a design system or component library, fill in a Figma documentation panel, or write usage guidelines / dos-and-don'ts for a UI component — even if they don't use the word "spec" explicitly (e.g. "can you write up the checkbox for our design system" or "I need docs for this dropdown component").
---

# Component Spec Writer

Produce a design-system-grade specification for one UI component, always following the same
10-section structure. The value of this skill is in **never fabricating** the parts that have a
ground truth (variants, properties, anatomy) and instead pulling them from the real Figma
component whenever one is available.

## Workflow

1. **Identify the source of truth.**
   - If the user gives a Figma link, or a Figma frame/component is selected/open, use the
     **Figma path** below. This is the default and preferred path — always try it first when any
     Figma context exists.
   - If there's no Figma access (no link, no MCP connection, nothing selected) and the user just
     describes the component or pastes a screenshot, use the **No-Figma path** below.
   - Don't ask which path to use — infer it from what's available, and only ask the user a
     clarifying question if you're genuinely blocked (e.g. a Figma link 404s, or the component
     name is ambiguous among several candidates).

2. **Identify the component type** (button, input, checkbox, radio, switch, tabs, dialog/modal,
   dropdown/select, tooltip, accordion, card, badge, etc.). This drives what states are plausible
   and which accessibility pattern applies — see `references/accessibility-patterns.md`.

3. **Fill the template** at `references/template.md`, section by section, per the rules below.

4. **Write the final spec as clean Markdown**, ready to paste into a docs site or a Figma
   documentation panel. Don't leave template guidance comments in the output — replace them.

Read `references/example-button.md` first if you want a calibration reference for tone, depth,
and formatting before writing the real thing — it's a fully worked Button spec.

## The Figma path (preferred)

When a Figma component is available, treat Figma as ground truth for the three sections that are
otherwise the easiest to fabricate convincingly: **Variants, Anatomy, Properties**.

- Use `get_metadata` and `get_design_context` on the component (or component set) to get its real
  layer tree and node names — this is where Anatomy names come from. Use the actual layer names
  (cleaned up for readability, e.g. `icon-leading` → "Leading icon"), don't invent generic ones.
- Read the component's actual **variant properties** (e.g. `Size`, `State`, `Emphasis`), **boolean
  properties** (e.g. `Has icon`, `Show label`), **instance-swap properties** (e.g. `Icon`), and
  **text properties** directly off the component set — these go verbatim into the Properties
  section, with their real names and real possible values. Do not guess a plausible property name
  if you haven't actually seen it in Figma.
- `get_screenshot` is useful to visually sanity-check anatomy and states once you have the design
  context back.
- If `search_design_system` is available and the design system has prior art (e.g. a similar
  component already documented), check it for established naming and reuse it for consistency
  rather than coining new terms.
- States and accessibility notes are *not* usually literal Figma variants — a component set might
  only have a `hover` variant per size, or might not model `focus`/`disabled` visually at all.
  It's fine (and expected) to supplement what Figma shows with the standard interactive states for
  that component type — see step 3 in the No-Figma path — as long as you don't attribute
  Figma-only sourcing to something you inferred.

If you have a Figma link but no MCP tool succeeds against it (wrong file permissions, stale link,
tool not connected), say so plainly and fall back to the No-Figma path rather than silently
inventing data.

## The No-Figma path

Without a real component to inspect, the honest failure mode is being confidently wrong about
variants and properties, since those are specific to how this particular team built the component
in Figma — there's no way to know them from general knowledge. Everything else about a component
type (its usual states, its anatomy, its accessibility behavior) is well-established enough to
draft responsibly.

- Ask the user for the component name, and a screenshot or description if they have one, rather
  than assuming which UI pattern they mean.
- Draft **When to use / When not to use / States / Anatomy / Usage rules / Accessibility notes**
  from general design-system and WAI-ARIA knowledge for that component type — these sections are
  about how the component *should* behave, which holds regardless of one team's Figma file.
- For **Variants** and **Properties**, either leave them as an open question for the user to
  answer, or draft your best guess clearly labeled as unconfirmed (e.g. "*Unconfirmed — verify
  against the Figma component:*"). Never present a guessed variant/property list as if it were
  read from Figma.

## Writing each section

- **What it is** — exactly one sentence, plain language, no jargon. A person unfamiliar with the
  design system should understand what the component is for.
- **When to use it** — concrete scenarios, not restatements of the definition. Think about the
  product situations that call for this component specifically.
- **When not to use it** — real misuse cases you'd actually see in review, each ideally paired
  with "use [other component] instead."
- **Variants** — one line per variant explaining its purpose/intent, not just its visual
  difference (e.g. "Ghost — for a low-emphasis action next to a stronger primary action," not
  just "Ghost — transparent background").
- **States** — every state the component actually supports. Don't list `loading` for a component
  that can't load, or `read-only` for a component with no notion of editability. Typical set to
  consider: default, hover, focus(-visible), active/pressed, disabled, loading, error/invalid,
  selected/checked, indeterminate, read-only — filtered to what applies.
- **Anatomy** — name every visible/structural part, in visual/logical order (e.g. outer-to-inner
  or left-to-right), each with a one-line role description.
- **Properties** — a table: Property name | Type (variant / boolean / instance-swap / text) |
  Values. This is the section most tied to the actual Figma file — see the two paths above.
- **Usage rules** — short Do / Don't lists, each item a concrete rule, not vague advice like "use
  good judgment."
- **Accessibility notes** — split into Keyboard and Screen reader subsections. Name actual keys
  and actual ARIA roles/states/announcements. Use `references/accessibility-patterns.md` to find
  the right WAI-ARIA APG pattern for this component type and ground the notes in it. Add a
  touch-target/contrast note only if relevant (e.g. skip touch-target sizing for a component that
  is never a standalone tap target).
- **Related atom components** — smaller components this one is built from, or components it's
  commonly paired with (e.g. a Select is often paired with a Label and a Helper Text atom; a
  Modal contains a Button and often an Icon Button for close). Write "None" if there genuinely
  isn't a meaningful relationship — don't force one.

## Reference files

- `references/template.md` — blank section-by-section template with guidance comments per
  section. Use this as the skeleton for the output.
- `references/example-button.md` — a fully worked Button spec, for calibrating depth and tone.
- `references/accessibility-patterns.md` — lookup table from component type to its WAI-ARIA APG
  pattern, plus the keyboard model for each, so accessibility notes are grounded rather than
  hand-wavy.
