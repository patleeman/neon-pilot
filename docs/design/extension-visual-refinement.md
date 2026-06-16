# Extension Visual Refinement Loop

Use this workflow when building or evaluating a generated Neon Pilot extension UI. The goal is one-shot quality from Patrick's perspective, even if the agent performs several internal generate/capture/judge/refine passes.

## Inputs

- `docs/design/neon-pilot-taste.md`
- `benchmarks/extension-quality/visual-rubric.md`
- relevant example-gallery notes under `docs/design/examples/`
- baseline screenshots of existing Neon Pilot surfaces that match the target surface class
- generated extension screenshots captured inside the real Neon Pilot host
- the original user task and expected extension behavior

## Loop

1. **Create visual concepts when the surface is frontend-heavy.**
   Generate several static visual directions before implementation when the UI shape is uncertain or the task is primarily visual. Pick one target direction, then implement against it. Do not treat code-model taste as the source of truth.

2. **Generate or patch the extension.**
   Build the real extension, not a static mock.

3. **Install/import it in Neon Pilot.**
   The route must open in the host shell. The frontend must invoke backend actions through the real extension action context.

4. **Capture visual evidence.**
   Capture existing app reference pages and the generated extension route. Include default/empty plus at least one populated, editor, error, loading, or secondary state when the workflow has one.
   For long pages, capture the first viewport, whole-page evidence, and scroll-depth views near the middle and bottom. A polished top viewport does not prove the page is consistent below the fold.

5. **Judge with the rubric.**
   Use multiple visual judges when available. Judges must inspect screenshots, score rubric dimensions, cite visual evidence, and return concrete must-fix items.

6. **Synthesize failures.**
   Convert judge findings into specific UI changes. Prefer structural fixes over cosmetic tweaking.

7. **Iterate.**
   Patch or regenerate, then repeat capture and judging until the extension passes the visual rubric and hard gates.

8. **Show the finalist.**
   Present Patrick with the best generated output, relevant screenshots, judge summary, and remaining tradeoffs.

9. **Promote learnings.**
   If Patrick identifies a reusable taste rule or negative smell, update `docs/design/neon-pilot-taste.md`, the example gallery, or the benchmark rubric.

## Concept Generation

Use visual concept generation as a front-end design aid, not as a replacement for implementation judgment.

Prompt the image generator with:

- Neon Pilot's IDE-like workbench taste
- the relevant layout mode
- density target
- surface constraints
- required controls and states
- negative smells to avoid

Generate multiple options, then pick one based on the taste doc before writing code. The chosen concept should answer:

- Where does navigation/context live?
- What appears in the first viewport?
- How dense are rows and controls?
- Which actions are icon/tool/menu based versus text?
- How are empty, selected, dirty, and error states represented?

Reject concepts that look like marketing pages, SaaS dashboards, glassy AI apps, or card stacks even if they are visually polished.

## Judge Expectations

Judges should reject generic "looks good" answers. A useful judge result names screenshot evidence and answers:

- Does it look like a Neon Pilot workbench contribution?
- Is it dense enough for IDE/tooling use?
- Is the surface flat and divider-light rather than box-in-box?
- Does it avoid unnecessary title/description noise?
- Are actions placed like IDE tools instead of scattered text buttons?
- Are structured controls used instead of lazy free-form inputs?
- Does empty/default state preserve the working layout?
- Does it avoid purple AI-gradient SaaS styling?
- Does it support inline or selection-driven editing where practical?
- Is negative space consistent across the whole page: row padding, section gaps, empty-state insets, control height, and right-edge action alignment?
- Does the same component grammar hold across sibling sections and extension-provided panels, or do lower-page areas quietly switch to bespoke boxes/forms?

## Hard Gates

Fail the visual pass when any of these are true:

- screenshots were not captured from the real host
- only a single viewport was captured for a long or scrollable page
- the route is blank, broken, or visually unjudgeable
- the page looks like a standalone SaaS app
- the main UI is sparse enough that the workflow cannot be understood
- normal object editing is modal-only when inline/detail editing would fit
- structured configuration is exposed mainly as JSON/textareas
- repeated operational records default to card grids without justification
- common tool actions are scattered as text buttons
- the design relies on nested cards, decorative gradients, glowing pills, or heavy custom chrome
- neighboring settings or panels use inconsistent padding, row structure, title hierarchy, or action alignment

## Repair Bias

When fixing a failed generated UI:

- If the failure is broad visual direction, generate new visual concepts before patching code.
- Start with layout mode and density before tweaking colors.
- Replace card stacks with rows, tables, lists, split panes, or inspectors.
- Remove redundant descriptions before adding more explanation.
- Replace text-button sprawl with toolbar icons, row actions, menus, or command-backed actions.
- Replace raw inputs with structured controls.
- Preserve the empty-state layout rather than centering a message in blank space.
- Keep the extension visually attached to the host shell.
