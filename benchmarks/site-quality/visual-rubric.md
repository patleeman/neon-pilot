# Neonpilot.net Visual Quality Rubric

Use this rubric with real screenshots from `neonpilot.net` or the local `apps/site` build. Do not score visual quality from source code alone.

Read `docs/design/neon-pilot-taste.md` before judging. The app is an IDE-like agent workbench; the public website can be more editorial than the app, but it must still feel durable, compact, neutral, technical, and product-led.

## Required Inputs

- Desktop and mobile screenshots of the homepage first viewport.
- Full-page or scroll-depth screenshots for the homepage.
- Screenshots for docs and extension pages when they are in scope.
- Current app screenshots used by the website, captured from the real app or staged under `apps/site/screenshots`.
- The intended audience and page goal when available.
- Optional visual concept references generated before implementation.

## North Star

The site should make Neon Pilot understandable and credible quickly:

- Within 5 seconds, a technical visitor should understand that Neon Pilot is a local macOS desktop agent runtime, not a generic hosted chatbot.
- The product should be visible through real, sharp app screenshots in the first viewport or immediately below it.
- The path from curiosity to action should be obvious: download, docs, GitHub, install command.
- The visual language should borrow the app's workbench durability without making the website feel like a fake embedded app.

## Scores

Use 1-5 for each dimension.

- **Product Clarity**: The page communicates what Neon Pilot is, who it is for, and why it exists without vague AI marketing.
- **First Viewport**: The first screen has a strong product signal, clear headline, visible action path, and a hint of what follows.
- **Screenshot Truthfulness**: App screenshots are real, current, sharp, readable, staged intentionally, and free of test labels or debug/test-only artifacts.
- **Technical Credibility**: Copy, imagery, install details, and docs links feel concrete and useful to a developer/operator audience.
- **Information Architecture**: Overview, docs, extensions, download, GitHub, and install paths are discoverable without competing navigation models.
- **Conversion Path**: Primary and secondary CTAs are specific, distinct, and placed where users naturally decide.
- **Product Narrative**: The page explains the loop from conversation to durable workspace to reusable extension/workflow with concrete examples.
- **Visual Hierarchy**: Headings, body copy, CTAs, screenshots, and feature sections scan in the intended order.
- **Density & Rhythm**: The site feels compact and intentional. It avoids both sparse hero emptiness and overloaded feature soup.
- **Surface Discipline**: Uses flat, technical sections and restrained framing. Avoids nested cards, decorative dashboard panels, and box-in-box clutter.
- **Brand Fit**: Feels like Neon Pilot: neutral, durable, technical, workbench-adjacent. Avoids generic AI SaaS and launch-page tropes.
- **Color Restraint**: Mostly neutral palette; accent color supports focus, links, and primary actions instead of decoration.
- **Typography & Copy**: Text is literal, compact, active, and readable. No hype, bloated subtitles, or repeated title/description noise.
- **Responsive Quality**: Mobile and narrow desktop layouts preserve hierarchy, avoid text collisions, keep screenshots useful, and keep CTAs reachable.
- **Accessibility Signals**: Semantic landmarks, alt text, focus states, contrast, touch targets, image dimensions, and keyboard behavior are visibly/accountably handled.
- **Performance Signals**: Critical assets are sized appropriately, above-fold imagery is prioritized, remote font/CDN usage is intentional, and no avoidable layout shift is apparent.
- **Polish**: Alignment, spacing, screenshot crops, link states, and section transitions feel deliberate across the full page.

## Decision

- **Pass**: Overall >= 4, no must-fix issues, and screenshot truthfulness >= 4.
- **Borderline**: Overall 3, or any meaningful issue that likely needs one more site pass.
- **Fail**: Overall <= 2, missing image access, broken layout, misleading/outdated screenshots, generic AI SaaS styling, or no clear download/docs path.

## Failure Tags

- `no_image_access`
- `blank_page`
- `broken_route`
- `unclear_product`
- `generic_ai_saas`
- `ai_purple_gradient`
- `stock_like_visuals`
- `fake_dashboard`
- `weak_first_viewport`
- `product_not_visible`
- `outdated_screenshots`
- `debug_or_test_artifacts`
- `blurry_screenshots`
- `misleading_screenshot_crop`
- `weak_cta_path`
- `install_path_hidden`
- `docs_path_hidden`
- `copy_hype`
- `title_description_noise`
- `too_sparse`
- `too_dense`
- `nested_cards`
- `box_in_box`
- `decorative_noise`
- `one_note_palette`
- `low_contrast`
- `layout_overlap`
- `responsive_breakage`
- `poor_text_wrapping`
- `keyboard_access_risk`
- `missing_alt_text`
- `image_cls_risk`
- `scroll_depth_inconsistent`

## Judge Output

Judges must return strict JSON:

```json
{
  "judge": "model-name",
  "imageAccess": true,
  "overall": 3,
  "decision": "pass|borderline|fail",
  "scores": {
    "productClarity": 3,
    "firstViewport": 3,
    "screenshotTruthfulness": 3,
    "technicalCredibility": 3,
    "informationArchitecture": 3,
    "conversionPath": 3,
    "productNarrative": 3,
    "visualHierarchy": 3,
    "densityRhythm": 3,
    "surfaceDiscipline": 3,
    "brandFit": 3,
    "colorRestraint": 3,
    "typographyCopy": 3,
    "responsiveQuality": 3,
    "accessibilitySignals": 3,
    "performanceSignals": 3,
    "polish": 3
  },
  "failureTags": ["weak_first_viewport"],
  "topFindings": ["Concrete visual finding with screenshot reference."],
  "mustFix": ["Specific visual change required before shipping."]
}
```
