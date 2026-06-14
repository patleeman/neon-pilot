# Extension Quality Rubric

Score each case after inspecting the task prompt, final answer, diff, and validation artifacts.

## Hard Gates

A case fails before qualitative scoring if any gate is violated:

- The extension does not build or has stale/missing `dist/` artifacts.
- `extension.json` declarations do not match source exports/actions.
- Runtime code imports desktop/core internals instead of public extension SDK surfaces.
- A UI surface opens blank or the declared route/control is missing.
- A UI case has no screenshot-backed visual review when the run is evaluating one-shot UI quality.
- Backend actions crash on ordinary malformed input instead of returning useful errors.
- The agent skipped user-visible validation entirely when the task had UI.

## Scores

Use 1-5 for each dimension.

### Product Fit

- 5: Solves the stated workflow with the right surface and no unnecessary complexity.
- 3: Mostly useful, but surface, scope, or workflow has noticeable friction.
- 1: Misunderstands the job or builds the wrong product shape.

### Frontend UX

- 5: Uses canonical shared primitives, clear density, constrained controls, command-backed actions, and polished empty/loading/error/success states.
- 3: Functional but has bespoke chrome, weak states, awkward controls, or minor layout risk.
- 1: Visibly rough, confusing, inaccessible, clipped, blank, or overbuilt.

Score this dimension from real screenshots or app inspection. If no screenshot-backed visual review exists, do not assign a score above 2.

### Backend Quality

- 5: Typed actions, validation, persistence, meaningful errors, and clean extension/core boundaries.
- 3: Works on happy path but has weak validation, persistence gaps, or brittle action contracts.
- 1: Broken, unsafe, or bypasses extension boundaries.

### Integration Completeness

- 5: Manifest, commands, routes/settings/tools, README, build artifacts, and smoke path are complete.
- 3: Main path works but docs, command wiring, diagnostics, or secondary contributions are incomplete.
- 1: Cannot be loaded or operated through the app as requested.

### Validation Quality

- 5: Runs relevant build/doctor/static checks and validates the user-visible path with useful evidence.
- 3: Runs partial checks but misses either app-path validation or important states.
- 1: Claims success without meaningful validation.

Screenshot-backed visual review is required for a 5 on validation quality when the task has a user-facing surface.

## Notes

Record concrete failure tags:

- `wrong_surface`
- `missing_ux_brief`
- `bespoke_ui`
- `missing_states`
- `no_command_contribution`
- `bad_manifest`
- `backend_validation_gap`
- `persistence_gap`
- `boundary_violation`
- `no_visual_qa`
- `build_failure`
- `doctor_failure`
