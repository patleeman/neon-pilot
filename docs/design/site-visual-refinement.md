# Neonpilot.net Visual Refinement Loop

Use this workflow when redesigning or evaluating the public website.

## Inputs

- `docs/design/neon-pilot-taste.md`
- `benchmarks/site-quality/visual-rubric.md`
- current screenshots from `apps/site/screenshots`
- local or deployed screenshots captured by `pnpm run eval:site-visual`
- optional generated visual concepts

## Loop

1. **Generate style concepts.**
   Use image generation for static website directions before major visual changes. Ask for product-led first viewports with real screenshot placement, compact technical copy, and restrained color. Reject generic AI SaaS, gradient-orb, fake-dashboard, or stock-like concepts.

2. **Pick a direction.**
   Choose the concept that best explains Neon Pilot as a local desktop agent runtime. Treat the concept as a target for hierarchy, density, screenshot placement, and rhythm, not a pixel-perfect spec.

3. **Patch the real site.**
   Update `apps/site` directly. Use real product screenshots and literal copy. Keep docs and extension paths easy to find.

4. **Capture evidence.**
   Run `pnpm run eval:site-visual` against the local build or deployed site. Capture desktop, mobile, viewport, full-page, and scroll-depth screenshots for long pages.

5. **Judge with the rubric.**
   Run `pnpm run eval:site-visual-judge` so judges inspect attached image inputs and return strict JSON.

6. **Synthesize failures.**
   Convert judge output into concrete patches. Prefer product clarity, screenshot truthfulness, responsive fixes, and information hierarchy before cosmetic changes.

7. **Iterate.**
   Repeat capture and judging until the site passes or remaining tradeoffs are explicit.

8. **Refresh app screenshots when needed.**
   Use `pnpm run site:capture-app-screenshots` to stage current public app screenshots under `apps/site/screenshots`. Screenshots used on the public site must omit test-only labels and debug/test attributes.

## Hard Gates

Fail the visual pass when any are true:

- screenshots were not available to the judge
- the first viewport does not identify the product
- the product is not visible through a real app screenshot near the top
- screenshots are outdated, blurry, misleadingly cropped, or show test/debug artifacts
- download, install, docs, or GitHub paths are hard to find
- mobile has overlap, clipped text, or unusable CTAs
- the page reads as generic AI SaaS
