# Design documentation

Use this folder as the source of truth for Neon Pilot's product design rules. It documents how app and extension surfaces should feel, how pages use the shell, and which visual patterns agents should avoid.

## Start here

- [Neon Pilot design taste](neon-pilot-taste.md) is the top-level taste guide. Read this before changing app UI, extension UI, settings, page layout, empty states, or visual copy.
- [Page template standards](page-template-standards.md) defines the approved route shell model, page types, left contextual area, right sidebar, loading, and empty-state rules.
- [Action button standards](action-button-standards.md) defines when to use icon buttons, toolbar buttons, text buttons, row buttons, and command-backed actions.
- [Design examples](examples/README.md) contains positive and negative visual anchors. Use these examples when judging generated UI or reviewing a page that feels off.

## Current standards

These files describe rules agents should apply to new work:

- [Neon Pilot design taste](neon-pilot-taste.md)
- [Page template standards](page-template-standards.md)
- [Action button standards](action-button-standards.md)
- [Extension visual refinement](extension-visual-refinement.md)
- [Site visual refinement](site-visual-refinement.md)

## Decision records

These files explain why the current standards exist. Use them for context, but prefer the standards above when building.

- [Page type decision](page-type-vetting.md)

## Example gallery

The example gallery records repeatable visual patterns:

- [Gallery overview](examples/README.md)
- [Sidebar examples](examples/sidebar/README.md)
- [Negative anchors](examples/negative/)

When a review finds a reusable rule, update the relevant standard. Do not let one-off notes become the main source of truth.

## Maintenance rules

- Keep design standards current with the implemented app.
- Delete migration plans once their decisions are absorbed into standards.
- Keep one-off redesign notes out of the top-level folder unless they are actively guiding current work.
- Update this README when adding a new design standard or decision record.
