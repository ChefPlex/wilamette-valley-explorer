# Threat Model

## Project Overview

Willamette Valley Explorer is a pnpm TypeScript monorepo with an Express 5 API server, PostgreSQL/Drizzle persistence, a React/Vite web map, and an Expo mobile app. The application exposes a public map of curated venues and a public "Valley Chef" AI assistant backed by a server-side OpenAI integration. There are no user accounts in the current production architecture; web and mobile clients are untrusted public clients.

The mockup sandbox is development-only and is not considered production-reachable unless future deployment configuration proves otherwise. In production, `NODE_ENV` is expected to be `production` and platform TLS terminates HTTPS automatically.

## Assets

- **Curated marker dataset** -- names, notes, categories, coordinates, websites, and city metadata shown to all users. Integrity matters because vandalism or spam changes the public map experience.
- **AI conversation data** -- user prompts and assistant responses stored in PostgreSQL. Users may enter sensitive or personal travel preferences, so conversations should not be exposed across unauthenticated visitors.
- **Application secrets** -- `DATABASE_URL`, OpenAI integration credentials, and `ADMIN_API_KEY`. Disclosure enables database access, AI service abuse, or administrative marker changes.
- **AI usage budget and backend availability** -- OpenAI calls consume metered resources and long-lived SSE streams consume server/database resources.
- **Client local state** -- saved lists and onboarding state stored in `localStorage` or `AsyncStorage`; this is user-local convenience data, not a server-side authorization boundary.

## Trust Boundaries

- **Public client to API** -- browser and mobile clients call `/api/*`. All input from these clients is untrusted and must be authenticated or constrained before mutating shared state or consuming expensive services.
- **API to PostgreSQL** -- the Express server reads and writes markers and chat conversations through Drizzle. Queries must remain parameterized and responses must not expose data outside the caller's authorization scope.
- **API to OpenAI integration** -- the server invokes the managed OpenAI endpoint using server-side credentials. Public requests that reach this boundary can create financial and availability impact.
- **Public user to shared map data** -- marker creation affects data displayed to all users. Public contributions require spam, validation, and moderation controls if intentionally allowed.
- **Admin operations** -- marker update/delete use `x-admin-key` and must remain server-enforced. Admin secrets must not be exposed to clients or logged.
- **Production versus development** -- `artifacts/mockup-sandbox`, local workflows, scripts, seed utilities, and Replit dev plugins are out of production scope unless deployment routing changes.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/markers.ts`, `artifacts/api-server/src/routes/openai/index.ts`, `artifacts/api-server/src/index.ts`.
- Data models: `lib/db/src/schema/markers.ts`, `lib/db/src/schema/conversations.ts`, `lib/db/src/schema/messages.ts`.
- Public clients: `artifacts/sonoma-map/src/components/Map.tsx`, `artifacts/sonoma-map/src/components/SonomaChef.tsx`, `artifacts/sonoma-mobile/app/(tabs)/index.tsx`, `artifacts/sonoma-mobile/app/(tabs)/chef.tsx`.
- Generated API/client packages are shared production support code: `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`.
- Highest-risk surfaces: unauthenticated marker creation, persisted AI conversation CRUD, OpenAI streaming calls, CORS/proxy/rate-limit configuration, and any rendering of database-backed marker or chat content.
- Dev-only areas to normally skip: `artifacts/mockup-sandbox`, local scripts, attached assets, generated UI component boilerplate, and development Vite/Replit plugins.

## Threat Categories

### Spoofing

The application currently has no per-user authentication. Any caller on the internet can act as a public user, create marker records, create chat conversations, and access conversation endpoints unless the route itself adds a separate control. Admin marker update/delete operations must validate `ADMIN_API_KEY` server-side and must not rely on client-side behavior.

### Tampering

Shared marker data is written to PostgreSQL and then displayed to every visitor. Public marker creation must be intentionally allowed and protected with rate limits, validation bounds, and moderation; otherwise attackers can alter the public map with spam, misleading locations, or abusive text. All database writes must continue to use parameterized Drizzle operations.

### Information Disclosure

AI conversations are persisted and may contain user-entered personal information. Without ownership, session, or capability-token checks, conversation IDs must not grant access to other users' histories. Errors and logs should avoid exposing request bodies, secrets, or raw database/OpenAI internals.

### Denial of Service

Public endpoints can consume database, CPU, and OpenAI resources. Marker reads are rate-limited, chat posting is rate-limited, and context is capped, but production must ensure all write and expensive endpoints have effective limits that cannot be bypassed through proxy-header spoofing. OpenAI streams should remain bounded and abort on disconnect.

### Elevation of Privilege

Administrative map modifications must stay isolated from public clients. Header-based admin secrets are acceptable only if strong, stored in environment secrets, never shipped to clients, compared safely, and paired with rate limiting/auditing. Public routes must not provide alternate ways to update/delete shared data or infer the admin secret.
