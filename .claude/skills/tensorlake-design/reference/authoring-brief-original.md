# Tensorlake — Sandboxes for AI Agents

## Mission
Create implementation-ready, token-driven UI guidance for Tensorlake — Sandboxes for AI Agents that is optimized for consistency, accessibility, and fast delivery across e-commerce storefront.

## Brand
- Product/brand: Tensorlake — Sandboxes for AI Agents
- URL: https://www.tensorlake.ai/
- Audience: online shoppers and consumers
- Product surface: e-commerce storefront

## Style Foundations
- Visual style: structured, tokenized, content-first
- Main font style: `font.family.primary=PP Neue Montreal`, `font.family.stack=PP Neue Montreal, Inter Tight, Neue Haas Grotesk, system-ui, sans-serif`, `font.size.base=16px`, `font.weight.base=500`, `font.lineHeight.base=normal`
- Typography scale: `font.size.xs=10px`, `font.size.sm=10.5px`, `font.size.md=11px`, `font.size.lg=12px`, `font.size.xl=13px`, `font.size.2xl=14px`, `font.size.3xl=15px`, `font.size.4xl=16px`
- Color palette: `color.text.primary=#ffffff`, `color.text.secondary=#989d9e`, `color.text.tertiary=#dddddd`, `color.text.inverse=#c9c9c9`, `color.surface.base=#000000`, `color.surface.muted=#161715`, `color.surface.raised=#0aa67d`, `color.surface.strong=#171e17`
- Spacing scale: `space.1=4px`, `space.2=7px`, `space.3=8px`, `space.4=10px`, `space.5=12px`, `space.6=14px`, `space.7=16px`, `space.8=18px`
- Radius/shadow/motion tokens: `radius.xs=2px`, `radius.sm=3px` | `shadow.1=rgb(10, 166, 125) 0px -1px 0px 0px inset` | `motion.duration.instant=120ms`, `motion.duration.fast=140ms`, `motion.duration.normal=180ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (56), cards (31), buttons (29), lists (3), inputs (1), navigation (1).


## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
