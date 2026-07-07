# Neon Pilot Design Audit

**Date:** June 23, 2026
**Auditor:** Claude Code
**Scope:** Desktop Application UI/UX Design System

## Executive Summary

Neon Pilot has a **well-architected component library** (`@neon-pilot/ui`) with 180+ primitives, a sophisticated theming system, and comprehensive Storybook documentation. However, the **actual implementation** shows significant inconsistencies, with extensive inline Tailwind styling bypassing the design system, creating a fragmented "AI-generated webapp" aesthetic rather than a cohesive desktop application experience.

**Key Findings:**

- ✅ Strong foundation: Excellent component library architecture
- ⚠️ Poor adoption: 513+ instances of inline Tailwind bypassing the design system
- ❌ Inconsistent patterns: Mixed usage of design tokens vs hardcoded values
- ❌ Web-app aesthetic: Lacks native desktop UI conventions
- ❌ Extension confusion: Agents struggle to build consistent UI due to unclear patterns

---

## 1. Design System Architecture (STRENGTHS)

### Component Library Structure

**Location:** `/packages/ui/`

**Strengths:**

- **180+ well-documented components** organized by category (Actions, Forms, Data Display, Overlays, etc.)
- **Comprehensive Storybook** with 10+ story files showing variants
- **Proper TypeScript types** and forwardRef patterns for accessibility
- **Semantic color system** with tone variants (accent, danger, warning, success, muted, steel)
- **Theme system** supporting light/dark modes with 6 accent color palettes
- **CSS custom properties** enabling runtime theme switching
- **Extension-friendly API** via `@neon-pilot/extensions/ui` re-exports

### Theme System

**Location:** `/packages/desktop/ui/src/ui-state/theme.ts`

**Strengths:**

- Clean RGB channel-based tokens (`--color-accent: 76 93 219`)
- Tailwind opacity modifiers work seamlessly (`bg-accent/10`)
- Built-in themes: `studio-light`, `studio-dark`
- Extension-contributed themes supported
- Proper dark mode handling

### CSS Architecture

**Structure:**

```css
@layer components {
  .ui-toolbar-button {
    /* Design system classes */
  }
  .ui-pill-accent {
    /* Semantic variants */
  }
  .ui-page-header {
    /* Layout patterns */
  }
}
```

**Strengths:**

- Tailwind CSS with custom layer organization
- Consistent naming convention (`ui-*` prefix)
- Design tokens properly mapped to Tailwind config

---

## 2. Critical Issues

### 2.1 Poor Design System Adoption

**Problem:** Despite having a comprehensive component library, the codebase shows **513+ instances** of inline Tailwind styling for buttons, borders, spacing, and colors that duplicate or bypass the design system.

**Evidence:**

#### Example 1: Custom Button Styling (AskUserQuestionToolBlock)

```tsx
// ❌ Instead of using <Button> component:
<button
  className={cx(
    'min-w-0 px-2 py-1 text-[12px] focus-visible:outline-none',
    'focus-visible:ring-1 focus-visible:ring-accent/50',
    'focus-visible:ring-offset-1 focus-visible:ring-offset-surface'
  )}
>
```

**Should be:**

```tsx
// ✅ Using the design system:
<Button variant="ghost" className="min-w-0 text-[12px]">
```

#### Example 2: Hardcoded Spacing and Borders

```tsx
// From chat components - mixing design system with custom classes
<div className="flex items-center gap-2 border-b px-3 py-2 text-[11px]">
<div className="px-3 py-2.5 max-h-96 overflow-y-auto">
<div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[10px]">
```

**Impact:**

- **Inconsistent spacing:** Some areas use `gap-2`, others `gap-1.5`, others `gap-2.5`
- **Inconsistent typography:** Mixing `text-[11px]`, `text-[12px]`, `text-[13px]`
- **Inconsistent borders:** Some use `border-border-subtle`, others write borders inline
- **Maintenance burden:** Changes require updating hundreds of individual files

#### Example 3: Duplicating Pill Styles (Skills Extension - user-facing surface archived)

```tsx
// ❌ Custom pill styling instead of using <Pill> tone variants:
<Button
  variant="ghost"
  className={cx(
    'rounded-full px-3 py-1 text-[12px]',
    skill.enabled ? 'border-success/40 bg-success/10 text-success' : 'border-subtle bg-muted text-secondary',
  )}
>
  {skill.enabled ? 'Enabled' : 'Disabled'}
</Button>
```

**Should be:**

```tsx
// ✅ Using the design system:
<Pill tone={skill.enabled ? 'success' : 'muted'}>{skill.enabled ? 'Enabled' : 'Disabled'}</Pill>
```

### 2.2 Web App Aesthetic vs. Desktop Native

**Problem:** The UI feels like a web application ported to desktop rather than a native desktop application.

**Issues:**

#### Visual Treatment

- **Excessive rounded corners everywhere** (`rounded-xl`, `rounded-lg`, `rounded-md`)
  - Desktop apps typically use sharper, more utilitarian corners
  - macOS native apps use subtle rounding only on key elements
- **Heavy box shadows and glows**
  - `.ui-dialog-shell` has elaborate multi-layered shadows
  - Input fields have animated glows for different states
  - Creates a "floating" web aesthetic rather than grounded desktop UI
- **Pastel/soft color palette**
  - Feels more like a consumer web app than a professional tool
  - Lacks the crispness of VS Code, Xcode, or Slack desktop apps

#### Layout Patterns

```css
.ui-page-header {
  @apply sticky top-0 z-10 border-b border-border-subtle
         bg-base/90 px-6 py-4 backdrop-blur-sm;
}
```

- **Web-style sticky headers** instead of fixed application chrome
- **Backdrop blur effects** (common in web, less common in native desktop)
- **Z-index management** suggests stacking context issues typical of web layouts

#### Typography

- **Inconsistent font sizes:** Text ranges from `text-[10px]` to `text-base` without clear hierarchy
- **No clear typographic scale:** Should have defined levels (body, caption, title, headline, etc.)
- **Mixing font units:** Some use `text-xs`, others use `text-[11px]`, creates inconsistency

### 2.3 Component Library Underutilization

**The component library README explicitly states:**

> "Prefer these components before writing local button, field, switch, notice, modal, menu, page, or status markup."

**However, the codebase shows:**

1. **Custom icon buttons everywhere** instead of `<IconButton>`
2. **Hardcoded input fields** instead of `<TextInput>`
3. **Custom modals** instead of `<Dialog>` components
4. **Inline status indicators** instead of `<Pill>`, `<StatusDot>`
5. **Custom loading states** instead of `<LoadingState>`, `<CenteredLoadingState>`

**Example from WorkspaceExplorer:**

```tsx
// ❌ Custom icon component:
function Ico({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      // ...
    >
      <path d={d} />
    </svg>
  );
}
```

**Should use:** A shared icon system from the design library.

### 2.4 Extension UI Inconsistency

**Problem:** Agents building extensions struggle with consistency because:

1. **Unclear patterns:** Extension examples mix design system components with custom styling
2. **Incomplete documentation:** Component library README is comprehensive, but actual usage patterns differ
3. **No enforcement:** No linting or build-time checks for design system usage

**Evidence from system-skills extension** (user-facing Skills surface archived; Prompt Assembly integration and agent-internal actions remain):

```tsx
// Mixing design system (AppPageLayout, ResourceList) with custom classes:
<ResourceListRow
  title={skill.name}
  titleClassName="text-[13px]" // ❌ Custom size
  detailClassName="text-[11px]" // ❌ Custom size
  actions={
    <Button
      className="rounded-full px-3 py-1 text-[12px]" // ❌ Custom styling
    />
  }
/>
```

**Impact:**

- Extensions look inconsistent with each other
- Agents produce UI that doesn't match the rest of the app
- Maintenance burden when design changes require updating 60+ extensions

### 2.5 Desktop Application Chrome Issues

**Top Bar (DesktopTopBar):**

```css
.ui-desktop-top-bar {
  @apply flex h-11 shrink-0 items-center gap-2
         border-b border-border-subtle bg-panel
         px-3 backdrop-blur-md;
}
```

**Issues:**

- **11px height is very small** for a desktop app title bar (macOS menu bars are 24px)
- **Generic "panel" background** lacks the visual weight of native app chrome
- **Lacks clear visual hierarchy** between window chrome and content area
- **Traffic light button spacing** handled with hardcoded 64px gap

**Workbench Layout:**

- No clear separation between "application chrome" and "document area"
- Side panels compete visually with main content
- Lacks the visual hierarchy of apps like VS Code where:
  - Activity bar (solid background, iconic)
  - Side panel (secondary background)
  - Editor area (brightest background)

---

## 3. Specific Problem Areas

### 3.1 Chat/Conversation UI

**Location:** `/packages/desktop/ui/src/components/chat/`

**Issues:**

- **Inconsistent message spacing:** Different gaps between message blocks
- **Unclear visual hierarchy:** User vs assistant messages not sufficiently distinct
- **Tool output cards:** Mix of custom borders, shadows, and spacing
- **Action buttons:** Inconsistent sizes and treatments

**Example inconsistencies:**

```tsx
// Different button treatments in the same context:
<div className="flex items-center gap-0 opacity-0 transition-opacity">  // gap-0
<div className="flex items-center gap-2">                                // gap-2
<div className="flex items-center gap-1 px-2 py-1">                     // gap-1
```

### 3.2 Workbench/Workspace UI

**Location:** `/packages/desktop/ui/src/components/workspace/`

**Issues:**

- **File tree styling:** Uses custom `--trees-*` CSS variables instead of design tokens
- **Mixed icon systems:** Some areas use inline SVGs, others use icon fonts
- **Inconsistent row heights:** File items have varying padding
- **Custom context menus:** Not using the `<MenuShell>` component consistently

### 3.3 Settings and Preferences

**Issues:**

- **Inconsistent form layouts:** Some use `<Field>`, others use custom label/input pairs
- **Mixed toggle patterns:** Some use `<Switch>`, some use custom styled checkboxes
- **Unclear grouping:** Settings panels lack consistent visual structure
- **Inconsistent action buttons:** Save/Cancel buttons styled differently across screens

---

## 4. Recommendations

### 4.1 Immediate Actions (High Priority)

#### A. Establish Design System Enforcement

**1. Create ESLint Rules**

```js
// Disallow direct Tailwind button/input styling
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='className'][value.value=/rounded-full|px-3 py-1|border-success/]",
        "message": "Use design system components instead of custom Tailwind classes"
      }
    ]
  }
}
```

**2. Add Build-Time Checks**

- Scan for `className` strings that duplicate component library functionality
- Flag imports from `'react'` for `<button>`, `<input>` without wrapping components
- Require usage of design system components in extension templates

**3. Update Extension Template**
Create `/extensions/template-extension/example-page.tsx`:

```tsx
// ✅ CORRECT PATTERN
import { AppPageLayout, Button, ResourceList, Pill } from '@neon-pilot/extensions/ui';

export function ExamplePage() {
  return (
    <AppPageLayout>
      {/* Use design system components */}
      <Button variant="action" tone="accent">
        Primary Action
      </Button>
      <Pill tone="success">Status</Pill>
    </AppPageLayout>
  );
}
```

#### B. Design Token Audit and Consolidation

**1. Typography Scale**
Define clear hierarchy in `/packages/ui/src/styles.css`:

```css
:root {
  /* Desktop application typography scale */
  --font-size-caption: 11px; /* Metadata, labels */
  --font-size-body: 13px; /* Body text, list items */
  --font-size-heading: 15px; /* Section headers */
  --font-size-title: 18px; /* Page titles */

  /* Line heights */
  --line-height-tight: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.7;
}
```

**2. Spacing Scale**

```css
:root {
  /* Consistent spacing tokens */
  --space-xs: 4px; /* Tight grouping */
  --space-sm: 8px; /* Related items */
  --space-md: 16px; /* Section spacing */
  --space-lg: 24px; /* Major sections */
  --space-xl: 32px; /* Page sections */
}
```

**3. Border Radius Scale**

```css
:root {
  /* Desktop-appropriate rounding */
  --radius-sm: 4px; /* Buttons, inputs */
  --radius-md: 6px; /* Cards, panels */
  --radius-lg: 8px; /* Modals, dialogs (reduce from 12px) */
}
```

#### C. Desktop Native Redesign

**1. Application Chrome**
Redesign the top bar with clearer hierarchy:

```tsx
// Proposed structure:
<DesktopTopBar>
  {/* Native traffic light spacing on macOS */}
  <TitleBar>
    <TrafficLights />
    <NavigationControls />
    <WindowTitle />
    <SearchBar />
    <UserControls />
  </TitleBar>
</DesktopTopBar>
```

**Styling goals:**

- Increase height to 40px (more substantial)
- Use solid background color (not translucent)
- Clear visual separation from content area
- Native-feeling controls and spacing

**2. Color Palette Revision**

- **Increase contrast** for better readability
- **Reduce opacity usage** in favor of solid colors
- **Sharper, more saturated accent colors** for professional tool feel
- **Study references:** VS Code, Linear, Figma, Slack desktop

**3. Visual Hierarchy**
Establish clear background levels:

```css
:root {
  /* Light theme */
  --bg-chrome: #f5f5f5; /* Window chrome, toolbars */
  --bg-sidebar: #fafafa; /* Side panels */
  --bg-editor: #ffffff; /* Main content area */
  --bg-elevated: #ffffff; /* Cards, modals */

  /* Dark theme */
  --bg-chrome: #1e1e1e; /* Window chrome */
  --bg-sidebar: #252526; /* Side panels */
  --bg-editor: #1e1e1e; /* Main content area */
  --bg-elevated: #2d2d2d; /* Cards, modals */
}
```

### 4.2 Medium-Term Actions

#### A. Component Library Refactoring Sprint

**Week 1-2: Audit and Consolidate**

1. Find all custom button/input/modal implementations
2. Replace with design system components
3. Remove duplicated utility classes

**Week 3-4: Chat UI Consistency**

1. Standardize message card layouts
2. Consolidate tool output patterns
3. Unify action button treatments

**Week 5-6: Workbench Consistency**

1. Standardize file tree styling
2. Consolidate icon system
3. Unify panel chrome

#### B. Extension Guidelines

**Create comprehensive guide:** `/docs/extension-ui-guidelines.md`

Include:

- ✅ Approved patterns with code examples
- ❌ Anti-patterns to avoid
- 🎨 Visual examples (Storybook links)
- 📋 Component selection flowchart
- 🔧 Testing checklist

**Example section:**

````markdown
## Showing Status

✅ **DO:** Use Pill components

```tsx
<Pill tone="success">Active</Pill>
<Pill tone="warning">Pending</Pill>
<Pill tone="danger">Failed</Pill>
```
````

❌ **DON'T:** Create custom status badges

```tsx
// ❌ Bad
<span className="rounded-full px-3 py-1 bg-green-100 text-green-800">Active</span>
```

### 4.3 Long-Term Vision

#### A. Design System 2.0

**Goals:**

- Desktop-native component variants
- Reduced visual weight (less blur, less shadow, less rounding)
- Professional tool aesthetic
- Stronger visual hierarchy
- Better extension templating

**Components to add:**

- `<NativeWindow>` - Proper window chrome
- `<Toolbar>` - Native toolbar patterns
- `<Sidebar>` - Native sidebar patterns
- `<SplitPane>` - Resizable panes with native splitters
- `<IconLibrary>` - Unified icon system

#### B. Visual Language Refresh

**Reference Apps for Inspiration:**

- **VS Code** - Clear hierarchy, professional, desktop-native
- **Linear** - Modern but not over-designed
- **Figma Desktop** - Sophisticated tool UI
- **Slack Desktop** - Consistent, accessible
- **Raycast** - Modern macOS native feel

**Design Principles:**

1. **Desktop-First:** Design for keyboard, power users, native conventions
2. **Clarity Over Beauty:** Prioritize information hierarchy and usability
3. **Consistency:** Every button/input/panel should be obviously part of the same system
4. **Accessibility:** Proper contrast, focus states, screen reader support
5. **Performance:** Reduce visual complexity, animations only where meaningful

---

## 5. Migration Plan

### Phase 1: Foundation (2 weeks)

- [ ] Define typography scale tokens
- [ ] Define spacing scale tokens
- [ ] Reduce border radius values
- [ ] Create ESLint rules for design system enforcement
- [ ] Update Tailwind config with new tokens

### Phase 2: Core Components (3 weeks)

- [ ] Audit all button usage → standardize to `<Button>`
- [ ] Audit all input usage → standardize to `<TextInput>`, etc.
- [ ] Audit all status indicators → standardize to `<Pill>`, `<StatusDot>`
- [ ] Consolidate icon system

### Phase 3: Layout & Chrome (2 weeks)

- [ ] Redesign DesktopTopBar
- [ ] Standardize sidebar chrome
- [ ] Standardize workbench panels
- [ ] Fix visual hierarchy (bg colors)

### Phase 4: Features (3 weeks)

- [ ] Chat UI consistency pass
- [ ] Workspace explorer redesign
- [ ] Settings screens consolidation
- [ ] Modal/dialog standardization

### Phase 5: Extensions (2 weeks)

- [ ] Create extension UI guidelines doc
- [ ] Update extension templates
- [ ] Audit existing extensions
- [ ] Provide migration examples

### Phase 6: Polish (1 week)

- [ ] Comprehensive visual QA
- [ ] Update Storybook with all patterns
- [ ] Update screenshots/docs
- [ ] Celebrate! 🎉

**Total estimated time:** 13 weeks for comprehensive overhaul

---

## 6. Success Metrics

### Quantitative

- **Design system adoption:** Target 95%+ of UI using `@neon-pilot/ui` components
- **Inline Tailwind reduction:** From 513+ instances to <50 (only for layout/spacing)
- **Component usage:** Track Button, TextInput, Pill, Dialog usage across codebase
- **Extension consistency:** All system extensions use design system components

### Qualitative

- **User perception:** "Feels like a professional desktop app, not a web app"
- **Extension developer feedback:** "Easy to build UI that looks right"
- **Internal velocity:** Faster to build new features with clear patterns
- **Visual coherence:** Every screen obviously part of the same product

---

## 7. Appendix: Reference Implementations

### Example 1: Proper Component Usage

```tsx
// ✅ GOOD: Using design system
import {
  AppPageLayout,
  AppPageSection,
  Button,
  Field,
  TextInput,
  ResourceList,
  ResourceListRow,
  Pill,
  LoadingState,
} from '@neon-pilot/extensions/ui';

export function SettingsPage() {
  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <AppPageLayout>
      <AppPageSection title="API Configuration" meta={<Pill tone="success">Connected</Pill>}>
        <Field label="API Key" hint="Your API key from the dashboard">
          <TextInput type="password" placeholder="sk-..." />
        </Field>

        <Button variant="action" tone="accent">
          Save Changes
        </Button>
      </AppPageSection>
    </AppPageLayout>
  );
}
```

### Example 2: Inconsistent Current Pattern

```tsx
// ❌ BAD: Current pattern mixing custom styles
export function SettingsPage() {
  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API Configuration</h2>
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Connected</span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">API Key</label>
        <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
        <p className="text-xs text-gray-500 mt-1">Your API key from the dashboard</p>
      </div>

      <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Save Changes</button>
    </div>
  );
}
```

---

## Conclusion

Neon Pilot has excellent design system **architecture** but poor **execution**. The component library is well-designed, but the product doesn't use it consistently, resulting in a fragmented, web-app-like aesthetic.

**The path forward:**

1. **Enforce** design system usage through tooling
2. **Redesign** for desktop-native feel (less rounded, less blur, more hierarchy)
3. **Consolidate** all custom UI into design system components
4. **Guide** extension developers with clear patterns
5. **Measure** adoption and consistency

With focused effort over 13 weeks, Neon Pilot can transform from "AI-generated webapp look" to "professional, cohesive desktop application."

---

**Next Steps:**

1. Review this audit with the team
2. Prioritize which phases to tackle first
3. Assign owners for each phase
4. Start with Phase 1 (Foundation) immediately
5. Track progress weekly
