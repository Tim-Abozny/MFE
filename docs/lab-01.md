# Lab 01 — Module Federation

Goal: make `shell` load independently built applications at runtime, and understand what
breaks when their dependencies get out of sync.

```text
shell:3000  (host)
├── loads orders:3001    at runtime
└── loads shipments:3002 at runtime
```

The point is not that a remote component appears on screen. The point is the whole path:

```text
navigate to /orders
→ shell downloads remoteEntry.js
→ finds the "./OrdersApp" entry in the exposes map
→ downloads the chunk that holds the implementation
→ negotiates shared dependencies through the shared scope
→ React renders the remote component
```

---

## Task status

| Task | What it asks | Status |
| --- | --- | --- |
| 01.1 | `orders` as remote, expose one section component | Done |
| 01.2 | `shell` as host, render remote via `React.lazy` + `Suspense` | Done |
| 01.3 | Reproduce eager consumption error, then fix with bootstrap | Done — [writeup](#experiment-013--synchronous-entry-point) |
| 01.4 | Declare the remote module in `.d.ts` | Done — [writeup](#typescript-and-the-remote-contract) |
| 01.5 | Inspect the built `remoteEntry.js` | Done — [writeup](#what-is-inside-remoteentryjs) |
| 01.6 | Break `shared` React, reproduce the hook error | **Not performed yet** |
| 01.7 | Mismatched major versions with and without `strictVersion` | **Not performed yet** |
| 01.8 | Second remote `shipments`, both lazy | Code done, Network measurement **not recorded yet** |
| 01.9 | Error Boundary per remote with a working Retry button | **Not implemented yet** |
| 01.10 | Standalone entry point for each remote | Done |
| 01.11 | Shell owns the prefix, remote owns inner routes, survives reload | Done |
| 01.12 | Remote URLs in a runtime config, not baked into the build | **Not implemented yet** |
| 01.13 | Bonus: same host on the Vite MF plugin | Not started |

Sections marked *not performed yet* below contain the plan only. No results are recorded
in them, because no results exist yet.

---

## Architecture

| Package | Role | Port | Container name | `output.publicPath` |
| --- | --- | ---: | --- | --- |
| `shell` | host | 3000 | `shell` | `/` |
| `orders` | remote | 3001 | `orders` | `auto` |
| `shipments` | remote | 3002 | `shipments` | `auto` |
| `api` | Express mock backend | 4000 | — | — |
| `ds` | local design system (`workspace:*`) | — | — | — |

All three frontends are produced by a single Webpack factory,
[`config/webpack.config.js`](../config/webpack.config.js). Each application passes only its
own directory, port, mode and federation block. There is no duplicated build config.

`output.uniqueName` is set to the container name for every build. Several Webpack runtimes
execute on the same page at the same time; without distinct unique names their global
runtime data and chunk registries collide.

`publicPath` differs on purpose:

- Remotes use `auto`. A remote is loaded from its own origin and must request its own
  chunks from that origin. With a wrong `publicPath` a remote chunk would be requested
  from the host — `http://localhost:3000/199.bundle.js` — and return 404.
- The host uses `/`. It is served from the root of its own origin, and a fixed root path
  keeps deep URLs such as `/orders/15` from resolving assets relative to `/orders/`.

---

## How to run in development

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts all four processes through `concurrently`:

```text
shell     → http://localhost:3000
orders    → http://localhost:3001
shipments → http://localhost:3002
api       → http://localhost:4000
```

A single application can be started on its own:

```bash
pnpm --filter @mfe/orders start
```

Type checking is a separate step, because `babel-loader` strips types without checking
them — nothing in the build ever runs `tsc`:

```bash
pnpm --filter @mfe/shell typecheck
pnpm --filter @mfe/orders typecheck
pnpm --filter @mfe/shipments typecheck
```

## How to build for production

```bash
pnpm --filter @mfe/orders build
pnpm --filter @mfe/shipments build
pnpm --filter @mfe/shell build
```

Each build writes to its own `dist/`. `output.clean` is enabled, so every build starts
from an empty directory.

## How to serve dist

> **Not verified yet.** Task 01.12 (runtime remote config) changes how the host resolves
> remote URLs, so production serving is verified after that task, not before. Working
> dev-server behaviour does not prove that a static `dist` is configured correctly —
> the two differ in exactly the places this lab is about: `publicPath`, CORS and SPA
> fallback.

Planned checks once implemented:

- each `dist` served by its own static server on 3000 / 3001 / 3002
- `remoteEntry.js` reachable at the remote origin
- remote chunks requested from the remote origin, not the host
- CORS headers allow the host to load remote assets
- SPA fallback: `/orders/15` still resolves after a hard reload
- one build of `shell` works against different runtime configs

---

## ModuleFederationPlugin configuration

Five fields matter, and each one has an owner and a failure mode.

### `name`

The global container name.

```js
name: "orders"
```

Must be unique across the page and must match the name the host uses in its `remotes`
string. A mismatch means the host looks for a container that never registers itself.

### `filename`

The name of the container entry file the remote emits.

```js
filename: "remoteEntry.js"   // → http://localhost:3001/remoteEntry.js
```

Remote only. The host never emits one, because `shell` declares no `exposes`.

### `exposes`

What the remote publishes.

```js
exposes: {
  "./OrdersApp": "./src/OrdersApp"
}
```

Left side is the public name used by consumers. Right side is the real local file. This is
the public contract of the remote: renaming the left side is a breaking change for every
host, renaming the right side is not.

### `remotes`

Where the host looks for containers.

```js
remotes: {
  orders: "orders@http://localhost:3001/remoteEntry.js"
}
```

```text
orders : orders @ http://localhost:3001/remoteEntry.js
  │        │                    │
alias   container name         URL
```

Host only. The alias is what appears in `import("orders/OrdersApp")`.

### `shared`

Dependencies negotiated between builds at runtime.

```js
shared: {
  react:              { singleton: true, requiredVersion: dependencies.react },
  "react-dom":        { singleton: true, requiredVersion: dependencies["react-dom"] },
  "react-router-dom": { singleton: true, requiredVersion: dependencies["react-router-dom"] },
  "react-router":     { singleton: true, requiredVersion: dependencies["react-router"] },
}
```

`requiredVersion` is read from the `dependencies` block of the package being built, so each
application states its own requirement rather than inheriting one from the factory.

#### Why `react-router` is shared as well as `react-router-dom`

In React Router v7 `react-router-dom` is a thin re-export layer. Its `package.json`
declares `"react-router": "7.18.2"` as a dependency, and the actual React contexts
(`NavigationContext`, `RouteContext`) live in `react-router`. Making only the wrapper a
singleton puts the singleton on the wrapper, not on the module that holds the state.

Before this was fixed, the setup happened to work — the single surviving copy of
`react-router-dom` dragged in exactly one copy of `react-router`, and no file in this repo
imports `react-router` directly. That is luck, not design. A single
`import { useParams } from "react-router"` — which is what the v7 documentation now
recommends — would have produced a second router context and
`useRoutes() may be used only in the context of a <Router>`.

Verified after the change, in both host and remote bundles:

```text
orders/dist/remoteEntry.js → "react" "react-dom" "react-router" "react-router-dom"
shell/dist/bundle.js       → "react" "react-dom" "react-router" "react-router-dom"
```

#### `shared` does not shrink the bundle

Measured on `orders`, production build, before and after adding `react-router` to `shared`:

| | before | after |
| --- | --- | --- |
| vendor chunks | 191 KiB + 174 KiB | 186 KiB + 174 KiB + 3.9 KiB |
| total | ~365 KiB | ~364 KiB |

Unchanged. `shared` does not remove the fallback copy from a build: every build still ships
its own copy, because it is needed if version negotiation fails and it is used if this build
wins and becomes the provider. The saving happens **at runtime** — one copy is downloaded
and executed — and it is visible in the Network tab, not in `ls dist`.

---

## What is inside `remoteEntry.js`

Measured on the production build of `orders`:

```text
remoteEntry.js   7 665 bytes
199.bundle.js    2 629 bytes   ← OrdersApp implementation
816.bundle.js    2 656 bytes   ← OrdersApp implementation (standalone path)
367.bundle.js  190 780 bytes   ← react-router fallback copy
196.bundle.js  178 158 bytes   ← react-dom fallback copy
```

`remoteEntry.js` is 7.5 KB while the dependencies it can hand out are two orders of
magnitude larger. It is a container entry point, not a bundle of the component. What is
actually in it:

- the container runtime;
- the `exposes` map — grepping the built file finds the literal string `"./OrdersApp"`;
- `get(module)` — returns a factory for an exposed module, downloading its chunk if needed;
- `init(shareScope)` — connects this container to the shared scope;
- the four shared keys it participates in: `"react"`, `"react-dom"`, `"react-router"`,
  `"react-router-dom"`;
- chunk identifiers, not chunk contents.

The host uses this file to discover *how* to obtain a module. The implementation arrives
separately, in the chunks the container points to.

Two practical notes:

- Chunk IDs (`199`, `367`, …) change between builds. They are not stable identifiers.
- In development `remoteEntry.js` is around 410 KB, because nothing is minimised and the
  dev runtime is included. The 7.5 KB figure is the production build. Comparing the two
  makes the "manifest, not bundle" point obvious.

---

## Why the async bootstrap is required

Every application has the same two-file entry:

```ts
// src/index.ts
import("./bootstrap");
```

```tsx
// src/bootstrap.tsx
const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element #root was not found");
}

createRoot(container).render(/* … */);
```

Reasoning, in the order the runtime executes it:

1. A dependency listed in `shared` is not compiled into the bundle. Webpack substitutes a
   broker module, visible in build output as
   `consume shared module (default) react@^19.2.8 (singleton)`.
2. At runtime the broker asks the shared scope for a matching copy. Each build registers
   its own copies there — `provide shared module (default) react@19.2.8`.
3. Populating that scope can require downloading a chunk, so it is asynchronous. The
   question "give me React" cannot be answered in the same synchronous tick in which it
   is asked.
4. Therefore application code must start **after** the scope is assembled, and the only
   way to tell Webpack where that boundary is, is a dynamic `import()` — it already
   returns a Promise and forces everything behind it into a separate chunk.

```text
bundle.js executes
→ federation runtime initialises the shared scope
→ the bootstrap chunk is downloaded
→ React is synchronously available inside it
```

### Experiment 01.3 — synchronous entry point

**What changed.** In `orders/src/index.ts`, `import("./bootstrap")` was replaced with the
static form `import "./bootstrap"`, removing the asynchronous boundary between the entry
and the application code. Two characters — the parentheses — are the whole boundary.

**What was expected.** A runtime failure while initialising shared dependencies.

**What actually happened.** The build succeeded — `webpack compiled successfully`. The page
rendered blank, and the browser console showed:

```text
Uncaught Error: Shared module is not available for eager consumption:
webpack/sharing/consume/default/react/react
    at __webpack_require__.m.<computed> (bundle.js:1151:54)
    at __webpack_require__ (bundle.js:314:32)
    at fn (bundle.js:642:21)
    at eval (react-dom-client.development.js:24190:15)
    at eval (react-dom-client.development.js:28120:5)
    at ../node_modules/.pnpm/react-dom@19.2.8_react@19.2.8/node_modules/react-dom/cjs/react-dom-client.development.js
    at __webpack_require__ (bundle.js:314:32)
    at fn (bundle.js:642:21)
    at eval (client.js:27:20)
    at ../node_modules/.pnpm/react-dom@19.2.8_react@19.2.8/node_modules/react-dom/client.js
```

**Why it happened.** Two things are worth separating.

*The error is a runtime error, not a build error.* Webpack cannot reject the configuration
at build time, because eager consumption is legal in some setups (`eager: true`). So it
compiles successfully and emits a branch in the broker module that throws in the browser
when the scope turns out to be unpopulated.

*The failing consumer is a library, not application code.* The stack shows the throw
originating in `react-dom/client.js` as it required `react`. The async boundary is not
needed by "my code" — it is needed by the entire module graph reachable synchronously from
the entry, and in practice a library reaches the shared module first.

**Resolution.** The dynamic import was restored (`git restore orders/src/index.ts`) and the
application returned to normal.

---

## TypeScript and the remote contract

`import("orders/OrdersApp")` is not an npm package, not a relative path, and does not exist
in `node_modules`. It is resolved by Module Federation at runtime, so TypeScript has to be
told the module will exist:

```ts
// shell/src/remotes.d.ts
declare module "orders/OrdersApp" {
  import type { ComponentType } from "react";

  const OrdersApp: ComponentType;
  export default OrdersApp;
}
```

The file is inside `shell/tsconfig.json`'s `include`, and `pnpm --filter @mfe/shell typecheck`
exits 0 — the declaration is actually compiled, not merely present.

This declaration does not load the remote, does not check that the remote is reachable, does
not verify that the real component matches, and emits no JavaScript.

### Evidence that the contract is unenforced

During this lab both `OrdersApp` and `ShipmentsApp` briefly carried a `basePath?: string`
prop while `remotes.d.ts` still declared them as bare `ComponentType` — a component with no
props. The declaration and the implementation disagreed, and nothing failed: no build error,
no type error, no runtime error. The prop was simply unreachable from the host, which could
not have passed it even deliberately.

That is the unsolved part of Module Federation. Webpack negotiates JavaScript at runtime;
it does not transport types between independently built applications. The `.d.ts` is a
hand-written promise, and nothing verifies that the remote still keeps it.

The prop was removed afterwards — it was never used. Both remotes navigate with relative
links (`to=".."`, `to={id}`), which resolve through the router context, and the context
already knows the mount prefix. Passing the prefix as a prop would have duplicated the
source of truth.

---

## Routing

One `BrowserRouter`, and it lives in the shell.

```text
shell
  /             → Home
  /orders/*     → OrdersApp
  /shipments/*  → ShipmentsApp

orders (inside the prefix the shell gave it)
  index         → OrdersList
  :orderId      → OrderDetails
```

A hosted remote never creates a second `BrowserRouter`; it consumes the router context the
shell provides. Two router instances would fight over the same URL.

Standalone mode wraps the *same* component in its own router:

```tsx
// orders/src/bootstrap.tsx
createRoot(container).render(
  <BrowserRouter>
    <OrdersApp />
  </BrowserRouter>,
);
```

No `basename` is set, so the remote serves its inner routes from its own root on port 3001.

### The prefix is never passed to the remote

All in-remote navigation is relative:

```tsx
<Link to={`${order.id}`}>   // list → details
<Link to="..">              // details → list
```

React Router resolves relative paths against the **route tree**, not the URL string, so the
same code produces the correct target in both modes:

| Mode | Parent of the remote's `<Routes>` | `..` resolves to |
| --- | --- | --- |
| hosted, shell owns `/orders/*` | `/orders` | `/orders` |
| standalone, router at root | `/` | `/` |

An earlier version used absolute `to="/orders"`, which worked when hosted and broke in
standalone: `http://localhost:3001/1` → Back → `/orders` matched the `:orderId` route with
`orderId = "orders"`, `Number("orders")` is `NaN`, and the page rendered *Order not found*.

### SPA fallback

`historyApiFallback: true` is set once in the dev-server block of the shared factory, so all
three applications get it. Without it, reloading `/orders/15` makes the static server look
for a file at that path and return 404, while in-app navigation to the same URL works —
a symptom that points at static serving, not at Module Federation.

---

## Error isolation

> **Not implemented yet** — task 01.9.

Planned structure, one boundary per remote so that a failure in one section cannot hide the
other or the navigation:

```text
OrdersRemoteBoundary
└── Suspense
    └── OrdersApp
```

`Suspense` and an Error Boundary do different jobs: `Suspense` shows a fallback while a
Promise is pending, an Error Boundary catches a rejected Promise or a render error.
`Suspense` is not a network error handler.

Each remote already has its own `Suspense` inside its own `<Route>` rather than one shared
wrapper around the whole shell.

The fallback must name the unavailable section, explain the problem, offer a Retry button
and a way back to the home page. The non-trivial part is Retry: Webpack caches the rejected
`import()`, so resetting the boundary's state alone will hand `React.lazy` the same rejected
Promise even after the remote's server is back up.

---

## Experiment: two React copies

> **Not performed yet** — task 01.6.

Plan: remove `react` and `react-dom` from the remote's `shared`, so `orders` bundles and
uses its own copy, add a real hook to `OrdersApp` (without a hook the problem can stay
invisible), and observe the result **in hosted mode** at `http://localhost:3000/orders`.
Standalone mode would keep working, because there is only one React on that page.

To be recorded: the configuration before the break, the exact console text, why a component
without hooks could still work, and why `singleton` removes the second copy.

## Experiment: strictVersion

> **Not performed yet** — task 01.7.

Plan: pick a small library genuinely used by both `shell` and `orders` — React itself is a
bad choice here, different majors bring too many side effects — install a different major
version in each, call it from both so Webpack keeps it in the runtime, declare it in
`shared`, then compare `strictVersion: false` against `strictVersion: true`.

To be recorded: exact versions, the warning text and which version actually won, then the
error text under `strictVersion`.

## Runtime remote configuration

> **Not implemented yet** — task 01.12.

Currently the remote URLs are baked into the host at build time:

```js
remotes: {
  orders: "orders@http://localhost:3001/remoteEntry.js"
}
```

That means one `dist` of the shell can only ever talk to one set of remotes, which breaks
the moment the same artifact has to run in dev, test and production — the situation Lab 06
puts it in.

Planned approach: `shell/public/mfe-config.json` fetched before `bootstrap`, stored on
`window.__MFE_CONFIG__`, and promise-based remotes that inject a `<script>`, wait for
`onload`, read the container off `window`, and expose `get`/`init` to Webpack. Cases that
must be handled: the same script added twice, a network error, a container missing from
`window` after a successful load, and repeated shared-scope initialisation.

Acceptance: build the shell once, change only the JSON, point it at a different remote
address, and confirm the unmodified build connects to it.

---

## Network verification results

> **Not recorded yet** — the measurement for task 01.8.

Procedure: DevTools → Network, *Disable cache* on, reload `/`, navigate to `/orders`, record
what loaded, and only then navigate to `/shipments`.

Expected on `/orders`: orders chunks loaded, shipments **component** chunks not loaded.

One caveat to record honestly rather than hide: with statically declared remotes the host
initialises remote containers as part of shared-scope setup, so `remoteEntry.js` itself may
be fetched earlier than the navigation. The requirement is that the *component code* of
`shipments` is not downloaded while on `/orders`. A fully dynamic loader (task 01.12) can
defer `remoteEntry.js` as well.

---

## Known limitations

- Types are not shared between applications. `shell/src/remotes.d.ts` is written by hand and
  nothing verifies it against the real remote — see the evidence above.
- Remote URLs are still baked into the shell build (task 01.12).
- No Error Boundary yet, so a dead remote currently takes down more than its own section
  (task 01.9).
- Production static serving has not been verified, only the dev server.
- `shared` fallbacks are duplicated in every `dist`. This is by design, but it means bundle
  size on disk is not a measure of whether sharing works.
- Chunk IDs are unstable across builds and must not be referenced anywhere but in ad-hoc
  inspection.
