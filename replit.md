# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

Server-side OpenAI integration (Replit-managed, no API key needed). Provides:
- `openai` — pre-configured OpenAI SDK client via `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`
- `generateImageBuffer`, `editImages` — image generation
- `voiceChatStream`, `textToSpeech`, `speechToText` — audio helpers
- `batchProcess`, `batchProcessWithSSE` — rate-limited batch processing

### `lib/integrations-openai-ai-react` (`@workspace/integrations-openai-ai-react`)

React client-side hooks for voice chat (`useVoiceRecorder`, `useVoiceStream`, `useAudioPlayback`).

### `artifacts/sonoma-map` (`@workspace/sonoma-map`)

React + Vite frontend. Leaflet.js interactive map of Willamette Valley, Oregon. Features:
- Custom winery/restaurant map markers with earthy terracotta/sage palette (Playfair Display + Plus Jakarta Sans)
- Sidebar with stats, filtering, and spot list
- Click-to-add markers with name, notes, category
- **Valley Chef AI assistant** — floating chat panel powered by GPT, uses the full Valley Chef persona (culinary authority, Willamette Valley and PNW expertise, Slow Food values, Oregon truffle/hazelnut/berry culture, ingredient-forward, seasonal awareness). Embedded at bottom-right of the map.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## Willamette Valley Explorer — Project Notes

### GPS Coordinate Verification Protocol

**Always use this three-step process before committing any pin coordinate. GPS accuracy is critical.**

1. **OSM Nominatim** — search by business name first:
   ```
   https://nominatim.openstreetmap.org/search?q=<Business+Name+City+CA>&format=json&limit=3
   ```
   If a POI result is returned (type: `amenity`, `tourism`, etc.), prefer it — it's the actual building footprint.

2. **Photon cross-check** — corroborate the Nominatim result:
   ```
   https://photon.komoot.io/api/?q=<Business+Name>&limit=3
   ```
   Both sources should agree within ~50 metres. If they diverge, investigate further.

3. **Fallback geocoders** (use if no POI exists in OSM/Photon):
   - **US Census TIGER geocoder** (address-based, very accurate for US addresses):
     ```
     https://geocoding.geo.census.gov/geocoder/locations/address?street=<STREET>&city=<CITY>&state=CA&benchmark=2020&format=json
     ```
   - **Google Maps** — extract coordinates from the URL: `!3d<LAT>!4d<LON>` pattern, or from Squarespace site config JSON for restaurant/winery websites.

**Never use address geocoding alone as the sole source.** Always cross-check at least two independent sources. Document the source used when adding a pin.

---

### Category System

4 categories (plain `text` field — no enum constraint in DB):

| Category | Color | Hex | Icon |
|---|---|---|---|
| `winery` | Wine red | Tailwind `primary` | Wine glass |
| `restaurant` | Amber | Tailwind `secondary` | Utensils |
| `farmstand` | Sage green | `#6f7d3c` | Leaf |
| `producer` | Terracotta | `#c06a2d` | Store |

Producers = artisan makers (creameries, cideries, spirits, etc.) that don't fit winery/restaurant/farmstand.

---

### Database & Seed Notes

- All spot additions go into `artifacts/api-server/src/seed.ts` first, then run the seed script.
- Production DB is read-only; production sync is triggered on deploy via `correctCoordinates()`.
- Splash screen counts are **dynamic** — pulled live from `GET /api/markers/stats`. No need to update hardcoded numbers when spots are added.
- Pins at the same property must be offset by ~0.0003° so they don't stack.
- The `correctCoordinates()` function also removes any markers not present in the current `SEED_DATA` — this was used to purge Sonoma-era data on re-localization.
- Map default center: `[45.1, -123.0]`, zoom `9` (covers the full valley from Portland to Eugene).

---

### Mobile App

- Bundle ID: `com.chefplex.willametteexplorer`
- GitHub: `ChefPlex/sonoma-explorer` (primary repo)
- App Store version must always be higher than the last approved build. Current version tracked in `artifacts/sonoma-mobile/app.json`.
- Build number is auto-incremented by EAS — do not hardcode it.

---

### Known Coordinate Flags

None outstanding.
