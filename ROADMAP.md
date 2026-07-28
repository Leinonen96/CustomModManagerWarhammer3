## Proposed Frontend Architecture

First, let's look at how your `frontend/` directory will be restructured. We will break the monolithic `main.ts` into specific domains of responsibility.

Plaintext

```
frontend/
├── main.ts              # Entry point: Initializes the app and binds events
├── types.ts             # Shared interfaces (Mod, AppConfig)
├── state.ts             # Centralized state (holds allMods, activeMods arrays)
├── api.ts               # API layer: ALL fetch() calls to Flask live here
└── components/
    ├── modManager.ts    # Logic for Sortable.js and DOM rendering
    ├── presets.ts       # Preset saving/loading logic
    └── settings.ts      # Settings modal logic
```

## The Migration Plan

**1.Initialize a Modern Build System:**Under 5 min.

Install a bundler to handle TypeScript imports. Run `npm install -D vite`. You will configure Vite (via a `vite.config.ts` file) to take `frontend/main.ts` as the entry point and output the compiled bundle directly to your `static/` folder. This means Flask doesn't need to change how it serves the static files.

**2.Extract the API Layer:**Backend Bridge.

Create `frontend/api.ts`. Move every single `fetch()` call out of your current `main.ts` into this file.

Wrap them in exported functions (e.g., `export async function fetchMods()`, `export async function saveConfig(config)`). _Why?_ If you rewrite your backend in Rust later, you only change this one file. The rest of the UI doesn't care.

**3.Centralize State and Types:**Data Management.

Move `interface Mod` and `interface AppConfig` into `types.ts`. Create `state.ts` to hold your global variables like `let allMods = []`. Export getter and setter functions so your components can safely read and update the mod list without mutating global variables directly.

**4.Modularize the UI Components:**DOM Manipulation.

Create the `components/` folder. Move the settings modal logic into `settings.ts`. Move the preset dropdown and save/load logic into `presets.ts`. Move the `Sortable` initialization and HTML element creation into `modManager.ts`. Each file will import the data it needs from `state.ts` and the network calls it needs from `api.ts`.

**5.Update Flask Template:**The Bridge.

In `templates/index.html`, update your script tag to support the new bundled output. If you use Vite, it will generate a single file, but if you decide to use native browser modules without a bundler, you must add `type="module"` to the script tag: `<script type="module" src="{{ url_for('static', filename='main.js') }}"></script>`.

### The Backend (Flask) Integration

The beauty of this plan is that **Flask barely has to change.**

Right now, Flask's job is twofold:

1. Serve the `index.html` and the `static/main.js` file.
    
2. Listen for JSON requests on `/api/...` routes.
    

By keeping Flask exactly as it is, and simply changing _how_ the TypeScript is organized before it compiles into `static/main.js`, you maintain complete compatibility. The only backend change you might consider during this phase is updating your `/api/heartbeat` route to ensure it plays nicely with the new modular frontend's lifecycle hooks.