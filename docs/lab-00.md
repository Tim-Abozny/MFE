# Lab 00 — Monorepo skeleton and mock API

Goal: build the monorepo and a fake backend, so that later labs never have to stop for
infrastructure work.

---

## Architecture and dependency management

- **pnpm workspaces** — a single workspace managing 5 independent packages (`shell`,
  `orders`, `shipments`, `api`, `ds`) with one root `node_modules` and symlinked local
  packages.
- **Local design system (`ds`)** — an independent package sharing constants, styles and
  TypeScript types with the frontends through `workspace:*`. pnpm links the local folder
  instead of copying it, so edits in `ds` are visible in `shell` immediately, with nothing
  published to npm.
- **React is not installed at the root.** Each application declares React in its own
  `package.json`. This matters in Lab 01: a root-level React would produce a
  falsely-working `shared` configuration and hide how federation actually resolves
  dependencies.

## Unified build factory (Webpack 5 + TypeScript)

- **Centralised configurator** — one Webpack configuration factory,
  [`config/webpack.config.js`](../config/webpack.config.js), removes all duplication
  between application folders. Each app passes its directory, port, mode and federation
  block.
- **Babel integration** — `babel-loader` with presets for modern JavaScript, TypeScript,
  and the automatic React 19 JSX runtime.
- **Environment separation**:
  - `development` — `eval-source-map` and `webpack-dev-server` with HMR;
  - `production` — optimised and minified output.
- **Port isolation** — `shell` 3000, `orders` 3001, `shipments` 3002, `api` 4000. Fixed
  early on purpose: these values later end up in the federation config, in CORS rules and
  in OIDC redirect URIs.

Note: `babel-loader` strips types without checking them, so the build never runs `tsc`.
Type checking is a separate `typecheck` script per package.

## Mock REST API (Express + Node.js)

Runs on port 4000 via the `tsx` loader. In-memory data generated with `Array.from()` and
`Math.random` — no database.

`GET /orders`:

- filtering by the `status` query parameter;
- pagination via `page` and `size`, applied *after* filtering, so `total` reports the size
  of the filtered set rather than the size of the page;
- a large-dataset generator, `?seed=N`, able to produce and process up to 10 000 objects
  per request — needed for list virtualisation in Lab 07.

Global middleware:

- **latency simulation** — every request is delayed by a random 300–600 ms, so loading
  states are actually observable;
- **forced errors** — the `x-force-status` header aborts the request with HTTP 401 or 500,
  which is what makes error handling testable in Labs 03 and 05.

Response shape:

```json
{ "items": [], "total": 25, "page": 2, "size": 5 }
```

## Development automation

`concurrently` at the workspace root. A single `pnpm dev` starts all four services in one
terminal with colour-coded per-service log prefixes.

---

## Acceptance

- [x] `pnpm install` from the root completes without errors
- [x] one command starts all four processes
- [x] `localhost:3000` / `3001` / `3002` render their own names
- [x] `localhost:4000/orders` returns JSON
- [x] `?page=2&size=5` returns the correct five-item slice
- [x] `total` counts the filtered set, not the page
- [x] status filter works
- [x] `POST /shipments` creates a record
- [x] responses are delayed by 300–600 ms
- [x] `x-force-status` can produce 401 and 500
- [x] `?seed=10000` works
- [x] production build succeeds for all three frontends
- [x] React is absent from the root `package.json`

Example request exercising everything at once:

```text
http://localhost:4000/orders?seed=10000&status=shipped&page=2&size=5
```
