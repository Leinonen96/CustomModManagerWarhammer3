# Warhammer III Mod Manager - Pro Studio Design System

## 1. Overview & Aesthetic Philosophy

The WH3 Mod Manager design system is engineered for **desktop productivity, high information density, and instant 144 FPS visual responsiveness**. It follows a **Pro Studio Dark** visual hierarchy inspired by creative workstation software (DaVinci Resolve, JetBrains, Blender) and modern desktop gaming utilities.

### Core Principles
1. **Zero Bubbly Fluff**: Sharp, precision geometry (`2px–3px` corner radiuses).
2. **Strict Design Token Hierarchy**: Single source of truth in `frontend/src/styles/tokens.css`.
3. **Zero-Cost GPU Rendering**: Hardware-accelerated 1px borders instead of costly composited box shadows.
4. **Instant Semantic Feedback**: Distinct semantic accents for states (Active, Missing, Modified, Danger).
5. **Cross-Platform Uniformity**: Custom SVG chevron select dropdowns and frameless native titlebars.

---

## 2. Design Tokens (`tokens.css`)

### Surfaces & Layers
| Token | Hex / Value | Purpose |
| :--- | :--- | :--- |
| `--color-bg-app` | `#07080B` | Deepest canvas layer |
| `--color-bg-base` | `#0B0D13` | List viewport and inactive panel container |
| `--color-bg-surface` | `#10131D` | Modals, panels, header toolbar |
| `--color-bg-surface-elevated`| `#151A27` | Secondary buttons, badge backings |
| `--color-bg-surface-hover` | `#192030` | Hover states on controls |
| `--color-bg-card` | `#131723` | Individual mod cards |
| `--color-bg-card-hover` | `#1A2031` | Mod card hover elevation |
| `--color-bg-card-active` | `#222A40` | Dragging / active card selection |

### Accents & Semantic Colors
| Token | Value | Meaning / Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#10B981` | Studio Emerald (Apply, active count, active order, primary actions) |
| `--color-primary-hover` | `#059669` | Primary button hover |
| `--color-primary-subtle` | `rgba(16,185,129,0.12)` | Active pill badge and focus rings |
| `--color-amber` | `#F59E0B` | Warning toasts, movie pack notice |
| `--color-cyan` | `#38BDF8` | Steam Workshop links, insert action, info toasts |
| `--color-danger` | `#EF4444` | Delete preset, deactivate mod, error toasts |
| `--color-danger-subtle` | `rgba(239,68,68,0.14)` | Danger button background |

### Typography Colors
| Token | Value | Application |
| :--- | :--- | :--- |
| `--color-text-primary` | `#F3F4F6` | Card titles, modal headers, button text |
| `--color-text-secondary` | `#9CA3AF` | Subtitles, descriptions, secondary buttons |
| `--color-text-muted` | `#6B7280` | File names, timestamps, inactive numbers |
| `--color-text-dim` | `#4B5563` | Placeholders, separators, metadata dots |

### Borders & Outlines
| Token | Value | Application |
| :--- | :--- | :--- |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.07)` | Card outline, panel dividers, titlebar bottom |
| `--color-border-medium` | `rgba(255, 255, 255, 0.13)` | Buttons, inputs, modals |
| `--color-border-hover` | `rgba(255, 255, 255, 0.22)` | Button hover border |
| `--color-border-focus` | `rgba(16, 185, 129, 0.55)` | Active focus rings |
| `--color-border-accent` | `rgba(16, 185, 129, 0.35)` | Active load order panel border |

### Geometry & Sizing
| Token | Value | Description |
| :--- | :--- | :--- |
| `--radius-sm` | `2px` | Buttons, inputs, mod cards, badges |
| `--radius-md` | `3px` | Panels, toolbars |
| `--radius-lg` | `4px` | Modals |
| `--control-height-sm` | `24px` | Micro-buttons, browse buttons, card actions |
| `--control-height-md` | `30px` | Standard buttons, selects, search inputs |
| `--control-height-lg` | `36px` | Hero buttons |

---

## 3. Component System & Class Contracts

### Buttons (`.btn`)
Every button uses 1-line flex centering, sharp `2px` radius, and instant hover states:

```html
<!-- Primary Action -->
<button class="btn btn-primary">⚡ APPLY TO GAME</button>

<!-- Secondary Toolbar Button -->
<button class="btn btn-secondary">📂 Load</button>

<!-- Danger Action -->
<button class="btn btn-danger">🗑️</button>

<!-- Micro Compact Button -->
<button class="btn btn-secondary btn-sm">📁 Browse</button>
```

### Form Controls
- **`<select class="select-input">`**: Custom SVG chevron via `--select-chevron-svg` eliminating OS-level rendering variations across Linux/Windows.
- **`<input class="text-input">`** & **`<input class="search-bar">`**: Uniform 30px height, inset padding, focus border highlight.

```html
<select class="select-input">
    <option value="campaign_mods">Campaign Preset</option>
</select>

<input type="text" class="text-input" placeholder="Preset name...">
<input type="text" class="search-bar" placeholder="Search mods...">
```

### Mod Item Cards (`.mod-item`)
Mod cards are designed for high throughput rendering (100–500 mods) with strict GPU layout boundaries:
- **Thumbnail**: `72px × 72px` with `object-fit: cover` and `contain: strict;`.
- **Order Number**: Interactive click-to-edit box with numeric validation.
- **Metadata**: Title (`0.96rem` bold), `.mod-filename` (`0.76rem` JetBrains Mono), `.mod-size-badge` (MB size), `.steam-link` (direct browser launch).
- **Micro Action Cluster**: Quick jump (`⤒`, `⤓`), insert (`# Insert`), remove (`✕`).

```html
<div class="mod-item" data-id="2789858755" data-name="!scm_totn.pack">
    <div class="order-num order-active order-editable">1</div>
    <div class="mod-thumb-container">
        <img class="mod-thumb" loading="lazy" decoding="async" src="asset://...">
    </div>
    <div class="mod-info">
        <div class="mod-name-row">
            <span class="mod-title">Tomb Kings Extended</span>
            <span class="mod-size-badge">245.2 MB</span>
        </div>
        <span class="mod-filename">!scm_totn.pack</span>
        <div class="mod-meta">
            <span class="steam-link">View on Steam ↗</span>
        </div>
    </div>
    <div class="mod-actions">
        <button class="card-action-btn btn-action-top">⤒</button>
        <button class="card-action-btn btn-action-remove">✕</button>
    </div>
</div>
```

---

## 4. Performance & Layout Containment

To ensure buttery smooth 144 FPS scrolling with hundreds of active mods:
1. **`content-visibility: auto; contain-intrinsic-size: auto 82px;`**: Off-screen mod cards skip layout and paint stages completely until scrolled into view.
2. **`contain: layout style paint;`**: Prevents DOM reflows inside cards from triggering parent recalculations.
3. **`transform: translateZ(0);`**: Forces hardware compositing layer creation.
4. **Native Asset Streaming**: Uses Tauri's `convertFileSrc` to load images asynchronously directly from disk without blocking the main JS thread.

---

## 5. Keyboard & UX Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>=</kbd> | Zoom in UI by +5% | Global |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> / <kbd>_</kbd> | Zoom out UI by -5% | Global |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset UI Zoom to 100% | Global |
| <kbd>Ctrl</kbd> + Mouse Wheel | Smooth dynamic UI zoom | Global |
| <kbd>Escape</kbd> | Dismiss open Modals / Dialogs | Global |
| Click on Order Number | Edit mod position directly | Active Mod Cards |
