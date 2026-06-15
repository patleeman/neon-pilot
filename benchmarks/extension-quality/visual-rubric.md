# Extension Visual Quality Rubric

Use this rubric with real screenshots from the Neon Pilot host. Do not score visual quality from source code alone.

Read `docs/design/neon-pilot-taste.md` before judging. Treat that document as the canonical application taste profile and use the named negative smells when reporting failures.

## Required Inputs

- Baseline screenshots from existing Neon Pilot surfaces that match the generated extension's surface class.
- Generated extension screenshots from the real app host.
- The original user task and expected primary surface.
- Empty/default plus at least one populated, editor, error, loading, or secondary state when the workflow has one.

## Scores

Use 1-5 for each dimension.

- **Host Fit**: Matches Neon Pilot's visual language, density, typography, and shared component chrome.
- **Information Hierarchy**: The main job, current state, and primary action are obvious within 3 seconds.
- **Workbench Fit**: Chooses the right Neon Pilot layout mode: chat + workbench, solo panel, list + detail, main + context tabs, or a rare modal/drawer focus.
- **Density & Layout**: Spacing and content density fit IDE/tooling use. Sparse is more often wrong than busy.
- **Surface Discipline**: Uses flat, divider-light workbench surfaces. Avoids box-in-box layouts, nested cards, and card grids for operational records.
- **Text Economy**: Avoids repeated title/description pairs and keeps secondary text reserved for operational value.
- **State Quality**: Empty, loading, error, success, disabled, and long-running states look intentional and distinct.
- **Control Taste**: Uses the most user-friendly input for each job: structured editors, key/value rows, segmented controls, toggles, selects, pickers, steppers, and tag/resource choosers when appropriate. Raw text inputs and textareas are reserved for genuinely free-form text, code, or prompt bodies.
- **Empty-State Density**: CRUD/list pages keep their real workflow shell visible before data exists: header actions, filters/search when useful, a list/table/resource region, and detail/editor/preview or guidance panel. A mostly blank page with a small centered message should fail unless the extension surface is intentionally tiny.
- **First-Launch Judgeability**: The initial screen must still show enough concrete structure to judge the product: starter templates, representative rows, a preview/guidance panel, or visible create/editor state. Blank database screens that are technically correct but visually empty should fail.
- **Data Surface Taste**: Starter content should feel purposeful, not like fake demo records. Metadata belongs in compact subdued properties, not prominent raw timestamp rows. Repeatable values such as tags must use true token/tag controls or selectable suggestions, never comma-separated text inputs.
- **Compositional Density**: Empty panes, starter areas, and form fields must balance the viewport. Empty list columns should not dominate the page, starter sections should be compact and task-shaped, and textareas should not swallow the editor before core metadata is complete.
- **Surface Selection**: Navigation models should use the host surface that already exists. If an extension nav item can replace the left sidebar body with `sidebarView`, do not build a second left rail inside the main page. Main pages should be the working editor/detail surface, not an embedded mini-app shell.
- **Action Chrome**: Common actions use IDE-like icon buttons, toolbars, rows, menus, and command-backed affordances. Text buttons are reserved for domain-specific, ambiguous, primary, or destructive actions.
- **Editing Model**: Durable objects use inline or selection-driven editing when practical. Modal CRUD is a failure unless the flow is short, blocking, destructive, or transient.
- **Interaction Clarity**: Primary, secondary, navigation, and destructive actions are visually clear and placed predictably.
- **Text Robustness**: Long titles, paths, prompts, logs, tags, and row content wrap or truncate without overlap.
- **Accessibility Signals**: Icon-only controls, inputs, focus states, and destructive actions are legible and inspectable.
- **Color Restraint**: Uses a neutral workbench palette with semantic color for selection, focus, active state, status, and charts. Avoids purple/blue AI-gradient SaaS styling.
- **Polish**: Alignment, rhythm, contrast, and composition feel finished; no nested-card clutter, decorative chips, text-button sprawl, or generic SaaS styling.

## Decision

- **Pass**: Overall >= 4 and no must-fix visual issues.
- **Borderline**: Overall 3 or any meaningful issue that likely needs one more UI pass.
- **Fail**: Overall <= 2, blank/missing route, serious host mismatch, broken layout, inaccessible controls, or no image access.

## Failure Tags

- `no_image_access`
- `blank_route`
- `host_mismatch`
- `wrong_layout_mode`
- `too_sparse`
- `too_dense`
- `weak_hierarchy`
- `generic_saas`
- `ai_purple_gradient`
- `bespoke_chrome`
- `nested_cards`
- `box_in_box`
- `decorative_noise`
- `decorative_status`
- `title_description_noise`
- `text_button_sprawl`
- `modal_crud_flow`
- `full_page_crud_form`
- `nested_in_page_sidebar`
- `wrong_surface_selection`
- `card_grid_default`
- `sparse_empty_state`
- `weak_empty_state`
- `empty_canvas`
- `unjudgeable_first_launch`
- `lazy_textarea`
- `emoji_artwork`
- `comma_tag_input`
- `raw_metadata_dump`
- `demo_seed_content`
- `dominant_empty_pane`
- `oversized_starter_section`
- `unbalanced_textarea`
- `wrong_input_control`
- `raw_json_editor`
- `missing_secondary_state`
- `poor_text_wrapping`
- `low_contrast`
- `unlabeled_icon_controls`
- `unclear_destructive_action`
- `layout_overlap`
- `responsive_risk`

## Judge Output

Judges must return strict JSON:

```json
{
  "judge": "model-name",
  "imageAccess": true,
  "overall": 3,
  "decision": "pass|borderline|fail",
  "scores": {
    "hostFit": 3,
    "workbenchFit": 3,
    "hierarchy": 3,
    "density": 3,
    "surfaceDiscipline": 3,
    "textEconomy": 3,
    "states": 3,
    "controlTaste": 3,
    "actionChrome": 3,
    "editingModel": 3,
    "interactionClarity": 3,
    "textRobustness": 3,
    "accessibilitySignals": 3,
    "colorRestraint": 3,
    "polish": 3
  },
  "failureTags": ["too_sparse"],
  "topFindings": ["Concrete visual finding with screenshot reference."],
  "mustFix": ["Specific visual change required before shipping."]
}
```
