# Frontend Design System & Architecture

## 1. Overview & Principles

The user interface is built for high information density, low latency, and efficient interaction when managing large collections of mod files.

### Core Principles
1. **Performance & Layout Containment**: Heavy use of CSS layout containment (`contain: layout style paint;`) and hardware-accelerated transforms to eliminate reflow bottlenecks during drag-and-drop operations.
2. **Consistent Design Tokens**: All colors, borders, typography, and geometry are centralized in `frontend/src/styles/tokens.css`.
3. **Deterministic UI State**: The view layer reacts directly to a centralized state store with atomic updates and automatic persistence.
4. **Vector Asset Consistency**: Standardized vector SVG icons throughout the interface with zero platform-dependent emoji rendering.

---

## 2. Design Tokens (`tokens.css`)

### Surfaces & Layers
| Token | Value | Application |
| :--- | :--- | :--- |
| `--color-bg-app` | `#07080B` | Root application background |
| `--color-bg-base` | `#0B0D13` | List viewport and inactive panel container |
| `--color-bg-surface` | `#10131D` | Modals, inspector drawer, toolbar |
| `--color-bg-surface-elevated`| `#151A27` | Secondary controls, badge backings |
| `--color-bg-surface-hover` | `#192030` | Interactive hover states |
| `--color-bg-card` | `#131723` | Individual mod cards |
| `--color-bg-card-hover` | `#1A2031` | Card hover state |
| `--color-bg-card-active` | `#222A40` | Active selection / drag state |

### Semantic Colors
| Token | Value | Application |
| :--- | :--- | :--- |
| `--color-primary` | `#10B981` | Primary actions (Deploy to Game, active counters, selected states) |
| `--color-primary-hover` | `#059669` | Primary action hover |
| `--color-primary-subtle` | `rgba(16,185,129,0.12)` | Subtle highlight backgrounds and active focus rings |
| `--color-amber` | `#F59E0B` | Pinned mod indicators, warnings, movie pack notices |
| `--color-cyan` | `#38BDF8` | Links, informational notices, relative rule indicators |
| `--color-danger` | `#EF4444` | Destructive actions, fatal collision indicators |
| `--color-danger-subtle` | `rgba(239,68,68,0.14)` | Danger button backings |

### Typography
| Token | Value | Application |
| :--- | :--- | :--- |
| `--color-text-primary` | `#F3F4F6` | Primary headings, card titles, button labels |
| `--color-text-secondary` | `#9CA3AF` | Subtitles, descriptions, secondary controls |
| `--color-text-muted` | `#6B7280` | File names, timestamps, inactive numbers |
| `--color-text-dim` | `#4B5563` | Separators, placeholders, metadata bullets |
| `--font-mono` | `'JetBrains Mono', monospace` | Pack filenames, checksums, order indexes |

### Geometry & Sizing
| Token | Value | Application |
| :--- | :--- | :--- |
| `--radius-sm` | `2px` | Buttons, inputs, badges, cards |
| `--radius-md` | `3px` | Panels, toolbars |
| `--radius-lg` | `4px` | Modal dialogs |
| `--control-height-sm` | `24px` | Compact toolbar items, card action buttons |
| `--control-height-md` | `30px` | Standard inputs, selects, buttons |
| `--control-height-lg` | `36px` | Hero action buttons |

---

## 3. Component Architecture & Class Contracts

### Buttons (`.btn`)
All buttons share uniform flex alignment, predictable padding, and subtle state transitions:

```html
<!-- Primary action -->
<button class="btn btn-primary">Deploy to Game</button>

<!-- Secondary action -->
<button class="btn btn-secondary">Load Preset</button>

<!-- Compact action -->
<button class="btn btn-secondary btn-sm">Browse</button>

<!-- Destructive action -->
<button class="btn btn-danger btn-sm">Delete</button>
```

### Mod Cards (`.mod-item`)
Mod cards are designed for high-density rendering (100–500+ items):
- **Thumbnail**: `72px × 72px` with `object-fit: cover` and asynchronous decoding.
- **Order Number (`.order-num`)**: Displays current index; supports direct numeric entry on click.
- **Metadata**: Title, packfile name (`font-mono`), size badge, Steam Workshop link.
- **Action Cluster**: Direct pin toggle, jump to top/bottom, inspect, remove.

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
    </div>
    <div class="mod-actions">
        <button class="card-action-btn" data-action="toggle-pin" title="Pin position">
            <svg class="action-icon" viewBox="0 0 24 24">...</svg>
        </button>
        <button class="card-action-btn" data-action="remove" title="Deactivate">
            <svg class="action-icon" viewBox="0 0 24 24">...</svg>
        </button>
    </div>
</div>
```

---

## 4. Performance & Rendering Strategy

1. **DOM Reconciliation**: When the load order changes, the renderer updates order badges and indices on existing DOM nodes in-place rather than rebuilding the entire card list.
2. **Layout Containment (`contain: layout paint;`)**: Restricts style calculations and repaints to the individual card boundary.
3. **Hardware Acceleration**: Transitions use GPU-composited properties (`opacity`, `transform`) to avoid layout thrashing during drag operations.
4. **Native Image Streaming**: Thumbnail paths are resolved through the native asset protocol, bypassing base64 serialization overhead.

---

## 5. Global Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>=</kbd> | Zoom UI in (+10%) | Global |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom UI out (-10%) | Global |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset UI zoom to 100% | Global |
| <kbd>Ctrl</kbd> + Mouse Wheel | Dynamic workspace zoom | Global |
| <kbd>Esc</kbd> | Dismiss active modal or inspector drawer | Global |
| Click on `#` badge | Direct numeric position input | Active Mod Cards |
