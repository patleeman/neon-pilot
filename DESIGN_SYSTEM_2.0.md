# Design System 2.0: Neon Pilot Professional Edition

**Date:** June 24, 2026  
**Vision:** Opinionated, Sharp, Fast  
**Inspired by:** VS Code

---

## Core Philosophy

**"Opinionated, Sharp, Fast"**

- **VS Code DNA**: Utilitarian over decorative, information hierarchy over beauty
- **Strong opinions**: One right way to do things, not infinite flexibility
- **Performance-first**: No unnecessary animations, blur, or visual effects
- **Cross-platform**: Works on macOS, Windows, Linux without feeling alien

---

## Design Decisions

### 1. Visual Direction: VS Code
- Utilitarian, clear hierarchy, no-nonsense
- Professional tool aesthetic, not consumer web app

### 2. Platform Strategy: Cross-platform Ready
- Avoid platform-specific patterns
- Focus on universal desktop conventions
- Works equally well on macOS, Windows, Linux

### 3. Priorities
1. **Polish** - Visual refinement, professional appearance
2. **Velocity** - Fast for developers (especially agents) to build consistent UI
3. **Performance** - Lightweight, no unnecessary visual effects

### 4. Extension Philosophy: Guardrails
- Very opinionated, hard to get wrong
- Limited choices by design
- Remove `className` prop from design system components
- Enforce consistency through type system and ESLint

### 5. Pain Points Being Addressed
- ❌ Too many rounded corners (feels web-like)
- ❌ Soft, pastel colors (lacks definition)
- ❌ Inconsistent spacing (no rhythm)
- ❌ Too generic (lacks opinion and character)

---

## Visual Language Changes

### 1. Geometry: Sharp & Structured

**Current Problem**: Rounded corners everywhere (`rounded-xl`, `rounded-lg`, `rounded-md`)

**Design System 2.0**:
```css
:root {
  /* Sharp, minimal rounding - VS Code style */
  --radius-none: 0px;       /* Panels, sidebars, chrome */
  --radius-sm: 2px;         /* Buttons, inputs */
  --radius-md: 4px;         /* Cards, only when needed */
  --radius-lg: 6px;         /* Modals (rare) */
  
  /* Remove these entirely */
  /* --radius-xl: 12px; */  ❌ TOO SOFT
  /* rounded-full */        ❌ TOO WEB-LIKE
}
```

**Application**:
- Window chrome, sidebars, panels: **0px radius** (sharp edges like VS Code)
- Buttons, inputs: **2px radius** (subtle but functional)
- Pills/badges: **2px radius** (not rounded-full)
- Modals: **4px radius** max

### 2. Color: Saturated & Defined

**Current Problem**: Soft, pastel colors with lots of opacity

**Design System 2.0 Palette**:

```css
:root[data-theme='light'] {
  /* Chrome & Structure - crisp grays */
  --color-chrome: #F3F3F3;        /* Top bar, toolbars */
  --color-sidebar: #F8F8F8;       /* Sidebar background */
  --color-editor: #FFFFFF;        /* Main content */
  --color-panel: #FFFFFF;         /* Elevated surfaces */
  
  /* Borders - visible, not subtle */
  --color-border: #E0E0E0;        /* Default borders */
  --color-border-active: #CCCCCC; /* Active/hover states */
  
  /* Text - high contrast */
  --color-text-primary: #1E1E1E;
  --color-text-secondary: #6B6B6B;
  --color-text-tertiary: #999999;
  
  /* Accent - VS Code blue (saturated, clear) */
  --color-accent: #007ACC;
  --color-accent-hover: #0062A3;
  --color-accent-active: #005A9E;
  
  /* Status colors - saturated, no pastels */
  --color-success: #0E8A16;      /* GitHub green */
  --color-warning: #F9A825;      /* Amber */
  --color-danger: #D32F2F;       /* Material red */
  --color-info: #1976D2;         /* Blue */
}

:root[data-theme='dark'] {
  /* Chrome & Structure - VS Code dark+ theme */
  --color-chrome: #1E1E1E;        /* Top bar */
  --color-sidebar: #252526;       /* Sidebar */
  --color-editor: #1E1E1E;        /* Main content */
  --color-panel: #2D2D2D;         /* Elevated */
  
  /* Borders */
  --color-border: #3E3E42;
  --color-border-active: #505053;
  
  /* Text */
  --color-text-primary: #CCCCCC;
  --color-text-secondary: #8B8B8B;
  --color-text-tertiary: #6B6B6B;
  
  /* Accent */
  --color-accent: #0E639C;
  --color-accent-hover: #1177BB;
  --color-accent-active: #127FD4;
  
  /* Status colors */
  --color-success: #4EC9B0;
  --color-warning: #FFCC00;
  --color-danger: #F48771;
  --color-info: #3794FF;
}
```

**Key Changes**:
- ❌ Remove opacity-based colors (`bg-accent/10`)
- ✅ Use solid, named colors with semantic meaning
- ❌ Remove translucent backgrounds (`bg-base/90`)
- ✅ Solid backgrounds with clear hierarchy

### 3. Spacing: Consistent & Rhythmic

**Current Problem**: Inconsistent gaps (0, 1, 1.5, 2, 2.5, 3, 4...)

**Design System 2.0 Scale** (8px base unit):
```css
:root {
  /* Strict spacing scale - only these values allowed */
  --space-0: 0px;
  --space-1: 4px;     /* Tight */
  --space-2: 8px;     /* Default */
  --space-3: 12px;    /* Comfortable */
  --space-4: 16px;    /* Sections */
  --space-6: 24px;    /* Major sections */
  --space-8: 32px;    /* Page sections */
  --space-12: 48px;   /* Rare, major spacing */
  
  /* Component-specific padding */
  --padding-button: 4px 12px;
  --padding-input: 6px 8px;
  --padding-panel: 16px;
  --padding-page: 24px;
}
```

**Rules**:
- Use only these tokens (no `gap-1.5`, `px-2.5`)
- Tailwind config maps to these: `gap-2` → `--space-2` (8px)
- ESLint enforces: no arbitrary values like `px-[13px]`

### 4. Typography: Functional Hierarchy

**Current Problem**: Too many sizes (`text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`)

**Design System 2.0 Scale**:
```css
:root {
  /* Clear hierarchy - only 5 sizes */
  --text-xs: 11px;       /* Captions, metadata */
  --text-sm: 12px;       /* Secondary text */
  --text-base: 13px;     /* Body, default (VS Code default) */
  --text-lg: 14px;       /* Emphasis */
  --text-xl: 16px;       /* Headings */
  
  /* Line heights */
  --leading-tight: 1.3;  /* Headings */
  --leading-normal: 1.5; /* Body */
  --leading-loose: 1.7;  /* Long-form */
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
}
```

**Semantic Classes** (replace all `text-[Xpx]`):
```css
.text-caption { font-size: var(--text-xs); }   /* Metadata */
.text-secondary { font-size: var(--text-sm); } /* Supporting text */
.text-body { font-size: var(--text-base); }    /* Default */
.text-emphasis { font-size: var(--text-lg); }  /* Important */
.text-heading { font-size: var(--text-xl); }   /* Titles */
```

---

## Component Architecture 2.0

### Principle: Guardrails by Design

Instead of flexible components with many variants, create **opinionated, purpose-built components**.

### Example 1: Button Redesign

**Current (too flexible)**:
```tsx
<Button variant="toolbar" tone="accent" className="rounded-full px-3" />
<ToolbarButton className="..." />
<IconButton size="sm" className="..." />
```

**Design System 2.0 (opinionated)**:
```tsx
// Only 3 button types - that's it
<Button.Primary>Save</Button.Primary>          // Accent color, stands out
<Button.Secondary>Cancel</Button.Secondary>    // Neutral, secondary action
<Button.Ghost>More...</Button.Ghost>           // Minimal, inline actions

// Icon buttons - single component, size from context
<IconButton icon={SaveIcon} label="Save" />

// NO custom className allowed on buttons (enforced by types)
```

**Implementation**:
```tsx
// Locked-down API
export const Button = {
  Primary: ({ children, ...props }: ButtonProps) => (
    <button className="ds-button-primary" {...props}>
      {children}
    </button>
  ),
  // className prop intentionally removed from type
};

// CSS is the source of truth
.ds-button-primary {
  padding: 6px 12px;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm); /* 2px */
  border: none;
}
```

### Example 2: Panel System

**Current (too generic)**:
```tsx
<div className="rounded-xl border bg-surface p-4" />
<SurfacePanel className="..." />
```

**Design System 2.0 (semantic)**:
```tsx
// Named by purpose, not appearance
<Panel.Sidebar>...</Panel.Sidebar>       // Left/right rails
<Panel.Content>...</Panel.Content>       // Main content area
<Panel.Toolbar>...</Panel.Toolbar>       // Top toolbars
<Panel.Inspector>...</Panel.Inspector>   // Property inspectors
<Panel.Dialog>...</Panel.Dialog>         // Modal overlays
```

**Each panel type has ONE look** - no customization needed.

### Example 3: Status Indicators

**Current (flexible pills)**:
```tsx
<Pill tone="success" className="rounded-full px-2" />
```

**Design System 2.0 (semantic)**:
```tsx
// Named by meaning, not color
<Status.Active />      // Green dot + "Active"
<Status.Pending />     // Yellow dot + "Pending"
<Status.Error />       // Red dot + "Error"
<Status.Idle />        // Gray dot + "Idle"

// Or just dots
<StatusDot status="active" />

// NO custom styling allowed
```

---

## Layout System 2.0

### VS Code-Inspired Layout Grid

```
┌─────────────────────────────────────────────┐
│ TopBar (Chrome)          [h: 35px, 0 radius]│ ← Solid, sharp
├────┬────────────────────────────────────┬───┤
│    │                                    │   │
│ S  │  Editor (Main Content)             │ P │
│ i  │                                    │ a │
│ d  │  [bg: --color-editor]              │ n │
│ e  │                                    │ e │
│ b  │                                    │ l │
│ a  │                                    │   │
│ r  │                                    │ R │
│    │                                    │ a │
│    │                                    │ i │
│    │                                    │ l │
│    │                                    │   │
├────┴────────────────────────────────────┴───┤
│ StatusBar                   [h: 22px, sharp]│
└─────────────────────────────────────────────┘
```

**Background Hierarchy**:
```tsx
const Layout = {
  Chrome: { bg: '--color-chrome' },     // Darkest/lightest
  Sidebar: { bg: '--color-sidebar' },   // Middle
  Editor: { bg: '--color-editor' },     // Brightest/main
  Panel: { bg: '--color-panel' },       // Elevated cards
};
```

**Rules**:
- All panels: `border-radius: 0` (sharp like VS Code)
- Borders: `1px solid var(--color-border)`
- NO blur, NO shadows (except modals)
- Clear 3-level hierarchy (chrome → sidebar → content)

---

## Component Library 2.0: The Essentials

### Core Components (locked down, opinionated)

```tsx
// BUTTONS - only 3 variants
Button.Primary
Button.Secondary
Button.Ghost
IconButton

// INPUTS - standardized
TextInput
TextArea
Select
Checkbox
Toggle

// LAYOUT
Panel.Sidebar
Panel.Content
Panel.Toolbar
Panel.Inspector
Panel.Dialog
Splitter  // NEW: VS Code-style resizable splits

// STATUS
Status.Active / Pending / Error / Idle
StatusDot
ProgressBar

// DATA DISPLAY
Table
List
Tree  // NEW: File tree component
CodeBlock

// FEEDBACK
Toast
Banner
Dialog
EmptyState
LoadingState
```

### Extension Template (single approved pattern)

```tsx
// extensions/template-extension/src/Page.tsx
import { 
  Panel,
  Button, 
  TextInput,
  Table,
  Status
} from '@neon-pilot/extensions/ui';

export function ExtensionPage() {
  return (
    <Panel.Content>
      {/* Header - standardized */}
      <Panel.Toolbar>
        <h1>Extension Title</h1>
        <Status.Active />
        <Button.Primary>Action</Button.Primary>
      </Panel.Toolbar>
      
      {/* Content - use approved components only */}
      <Table>
        {/* ... */}
      </Table>
    </Panel.Content>
  );
}

// NO className prop anywhere
// NO inline styles
// NO custom components
```

---

## Implementation Strategy

### Phase 1: Token Foundation (Week 1)

Create `/packages/ui/src/tokens.css`:
```css
/* Design System 2.0 Tokens */
/* NO OVERRIDES ALLOWED */

:root {
  /* Geometry */
  --radius-none: 0px;
  --radius-sm: 2px;
  --radius-md: 4px;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Typography */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-lg: 14px;
  --text-xl: 16px;
  
  /* Colors - Light theme */
  /* ... full palette */
}

/* Lock down the grid */
[data-theme='dark'] {
  /* Dark theme overrides */
}
```

### Phase 2: Component Lockdown (Week 2-3)

Rewrite components with **no className prop**:

```tsx
// packages/ui/src/Button.tsx
interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  // NO className - force design system
}

export const Button = {
  Primary: (props: ButtonProps) => (
    <button {...props} className="ds-button-primary" />
  ),
  Secondary: (props: ButtonProps) => (
    <button {...props} className="ds-button-secondary" />
  ),
  Ghost: (props: ButtonProps) => (
    <button {...props} className="ds-button-ghost" />
  ),
};

// CSS does ALL styling
```

### Phase 3: Migration Tool (Week 3)

Create codemod to auto-migrate:

```bash
# Automated migration
pnpm ds2-migrate packages/desktop/ui/src/components/

# Converts:
<Button variant="action" tone="accent" className="px-4">
# To:
<Button.Primary>
```

### Phase 4: ESLint Enforcement (Week 4)

```js
// .eslintrc.js
rules: {
  // Block old patterns
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['**/ui'],
      importNames: ['Button', 'Pill'],  // Old exports
      message: 'Use Button.Primary or Status.Active from DS2.0'
    }]
  }],
  
  // Block className on DS components
  'react/forbid-component-props': ['error', {
    forbid: [{
      propName: 'className',
      allowedFor: ['div', 'span'],  // Only primitives
    }]
  }],
  
  // Block arbitrary Tailwind values
  'no-restricted-syntax': ['error', {
    selector: 'JSXAttribute[value.value=/text-\\[\\d+px\\]/]',
    message: 'Use semantic text classes: text-caption, text-body, etc.'
  }]
}
```

---

## Success Criteria

### Quantitative
- ✅ **100% of buttons** use `Button.Primary/Secondary/Ghost` (no variants)
- ✅ **0 instances** of `className` on design system components
- ✅ **0 arbitrary values** (`text-[11px]`, `px-[13px]`, etc.)
- ✅ **5 font sizes total** (down from 10+)
- ✅ **8 spacing values** (down from 20+)

### Qualitative
- ✅ "Looks like a professional dev tool, not a web app"
- ✅ "Impossible to build inconsistent UI as an extension developer"
- ✅ "Every screen obviously uses the same design system"

---

## Migration Timeline

### Immediate: Foundation Setup
**Week 1**: Create tokens.css, update Tailwind config, set up ESLint rules

### Short-term: Core Components
**Week 2-3**: Rewrite Button, TextInput, Panel with locked-down APIs

### Medium-term: Codebase Migration
**Week 4-6**: 
- Create migration tool
- Convert desktop UI components
- Update all system extensions

### Long-term: Stabilization
**Week 7-8**:
- Visual QA across all screens
- Extension template updates
- Documentation and Storybook refresh

**Total Time**: 8 weeks to full Design System 2.0 adoption

---

## Next Actions

1. **Start implementing Phase 1** (tokens.css + Tailwind config)
2. **Prototype Button.Primary/Secondary/Ghost** to see the new API
3. **Create the extension template** with the guardrails approach
4. **Build a migration tool** to convert existing code

---

## Philosophy Summary

**Design System 1.0 Problem**: Too flexible, too generic, looks like a web app

**Design System 2.0 Solution**: Opinionated, sharp, desktop-native

- **Geometry**: Sharp edges (0-4px radius max)
- **Color**: Saturated, high-contrast, no opacity tricks
- **Spacing**: Strict 8px scale, enforced by ESLint
- **Typography**: 5 sizes, semantic names
- **Components**: Locked-down APIs, no className prop
- **Extensions**: Single template, impossible to get wrong

**Result**: Professional desktop tool that agents can't break
