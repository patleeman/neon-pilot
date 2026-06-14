# Extension Visual Quality Rubric

Use this rubric with real screenshots from the Neon Pilot host. Do not score visual quality from source code alone.

## Required Inputs

- Baseline screenshots from existing Neon Pilot surfaces that match the generated extension's surface class.
- Generated extension screenshots from the real app host.
- The original user task and expected primary surface.
- Empty/default plus at least one populated, editor, error, loading, or secondary state when the workflow has one.

## Scores

Use 1-5 for each dimension.

- **Host Fit**: Matches Neon Pilot's visual language, density, typography, and shared component chrome.
- **Information Hierarchy**: The main job, current state, and primary action are obvious within 3 seconds.
- **Density & Layout**: Spacing and content density fit the surface: main page, rail, composer, transcript, settings, or detail pane.
- **State Quality**: Empty, loading, error, success, disabled, and long-running states look intentional and distinct.
- **Interaction Clarity**: Primary, secondary, navigation, and destructive actions are visually clear and placed predictably.
- **Text Robustness**: Long titles, paths, prompts, logs, tags, and row content wrap or truncate without overlap.
- **Accessibility Signals**: Icon-only controls, inputs, focus states, and destructive actions are legible and inspectable.
- **Polish**: Alignment, rhythm, contrast, and composition feel finished; no nested-card clutter, decorative chips, or generic SaaS styling.

## Decision

- **Pass**: Overall >= 4 and no must-fix visual issues.
- **Borderline**: Overall 3 or any meaningful issue that likely needs one more UI pass.
- **Fail**: Overall <= 2, blank/missing route, serious host mismatch, broken layout, inaccessible controls, or no image access.

## Failure Tags

- `no_image_access`
- `blank_route`
- `host_mismatch`
- `too_sparse`
- `too_dense`
- `weak_hierarchy`
- `generic_saas`
- `bespoke_chrome`
- `nested_cards`
- `decorative_noise`
- `weak_empty_state`
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
    "hierarchy": 3,
    "density": 3,
    "states": 3,
    "interactionClarity": 3,
    "textRobustness": 3,
    "accessibilitySignals": 3,
    "polish": 3
  },
  "failureTags": ["too_sparse"],
  "topFindings": ["Concrete visual finding with screenshot reference."],
  "mustFix": ["Specific visual change required before shipping."]
}
```
