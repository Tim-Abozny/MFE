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
| 01.6 | Break `shared` React, reproduce the hook error | Done — [writeup](#experiment-016--two-react-copies) |
| 01.7 | Mismatched major versions with and without `strictVersion` | Done — [writeup](#experiment-017--requiredversion-singleton-and-strictversion) |
| 01.8 | Second remote `shipments`, both lazy | Done — [measurements](#network-verification-results) |
| 01.9 | Error Boundary per remote with a working Retry button | Done — [writeup](#error-isolation) |
| 01.10 | Standalone entry point for each remote | Done |
| 01.11 | Shell owns the prefix, remote owns inner routes, survives reload | Done |
| 01.12 | Remote URLs in a runtime config, not baked into the build | Done — [writeup](#runtime-remote-configuration) |
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

Each `dist` is served independently, exactly as three separately deployed applications would
be:

```bash
npx serve -s shell/dist     -l 3000 --cors
npx serve -s orders/dist    -l 3001 --cors
npx serve -s shipments/dist -l 3002 --cors
pnpm --filter @mfe/api start
```

Two flags carry the whole difference from the dev server:

- **`-s`** — serve `index.html` for unknown paths. Without it a reload on `/orders/15` makes
  the server look for a file at that path and return 404. This replaces
  `devServer.historyApiFallback`.
- **`--cors`** — send `Access-Control-Allow-Origin: *`. Without it the host cannot fetch a
  remote's `remoteEntry.js` from another origin. This replaces the `headers` block of the dev
  server config.

Both were supplied by `webpack-dev-server` through the shared factory during development.
Nothing supplies them in production, which is why this is a separate acceptance step.

### Acceptance results

| Check | Result |
| --- | --- |
| `localhost:3001/remoteEntry.js` returns JavaScript, not HTML or 404 | pass |
| remote chunks requested from `:3001` / `:3002`, never from the host | pass |
| no `blocked by CORS policy` in the console | pass |
| `/orders` renders the live list | pass |
| `/orders/:id` renders the details page | pass |
| hard reload on `/orders/15` still resolves | pass |
| standalone `localhost:3001/1` + reload | pass |
| lazy loading — nothing from `:3002` while on `/orders` | pass |
| stopped remote leaves the shell and its navigation alive | pass |
| Retry reloads the remote without a page refresh | pass |
| one build against a changed runtime config | pass |

One defect was found only at this stage and is written up under
[Dev/prod divergence](#devprod-divergence-found-during-acceptance).

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
// shell/src/remotes.d.ts — as originally written for task 01.4
declare module "orders/OrdersApp" {
  import type { ComponentType } from "react";

  const OrdersApp: ComponentType;
  export default OrdersApp;
}
```

The file sits inside `shell/tsconfig.json`'s `include`, so `pnpm --filter @mfe/shell typecheck`
compiles it rather than ignoring it. That command is the only thing in this repository that
runs `tsc` at all: `babel-loader` strips types without checking them, so nothing in the build
would have caught a broken declaration.

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

### Where the contract lives now

Task 01.12 replaced the container-name import with a runtime loader, so nothing imports
`"orders/OrdersApp"` any more and both `declare module` blocks became dead code. They were
removed. `shell/src/remotes.d.ts` now declares only what is genuinely missing from
TypeScript's view of the world — the two Webpack free variables and the runtime config on
`window`:

```ts
declare const __webpack_init_sharing__: (scope: string) => Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };

interface Window {
  MFE_CONFIG?: Record<string, string>;
}
```

Those two identifiers do not exist in source at all — Webpack substitutes implementations at
build time. That is why the build succeeded while `tsc` reported
`Cannot find name '__webpack_init_sharing__'`: the two tools disagree about what exists.

The remote contract moved into the loader's return type:

```ts
loadDynamicRemote(remoteName: string, moduleName: string): () => Promise<{ default: ComponentType }>
```

The form changed; the underlying problem did not. This is still a hand-written assertion
about a module that will only exist at runtime, and nothing checks it against the remote.

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

Each remote is wrapped in its own boundary, inside its own `<Route>`, so a failure in one
section can hide neither the other section nor the navigation:

```text
<Route path="/orders/*">
  RemoteErrorBoundary sectionName="Orders"
  └── Suspense fallback="Loading Orders Section…"
      └── OrdersApp        (React.lazy)
```

`Suspense` and an Error Boundary do different jobs, and both are required:

| Component | Handles |
| --- | --- |
| `Suspense` | the waiting state while the import Promise is pending |
| Error Boundary | a rejected Promise or a render error below it |

`Suspense` is not a network error handler. A remote is a network request and can 404 after a
bad deploy — without a boundary the whole shell goes blank.

`RemoteErrorBoundary` is a class component because React still has no built-in hook
equivalent. It implements `getDerivedStateFromError` (switch to the fallback UI) and
`componentDidCatch` (log with the section name). The fallback names the unavailable section,
explains the problem, and offers **Retry** plus a link **Home**.

### Why the Retry button is the hard part

The obvious implementation — reset the boundary's state, or remount it with a changing
`key` — **cannot work**, and the reason is worth stating precisely, because it is four
separate caches sitting below React.

**Layer 1 — `React.lazy` memoises the rejection.** A `lazy()` object stores its own status:

```js
{ $$typeof: REACT_LAZY_TYPE, _payload: { _status, _result }, _init }
```

Once the import Promise rejects, `_status` becomes `Rejected` and every later render does
`throw payload._result` without ever calling the import function again. If the `lazy` is a
module-level constant, remounting the boundary hands the new subtree the same poisoned
object.

**Layer 2 — the container module is cached.** With statically declared remotes Webpack
generates a module whose `module.exports` *is* the loading Promise:

```js
/***/ "webpack/container/reference/orders"
module.exports = new Promise((resolve, reject) => {
	if(typeof orders !== "undefined") return resolve();
	__webpack_require__.l("http://localhost:3001/remoteEntry.js", (event) => {
		__webpack_error__.name = 'ScriptExternalLoadError';
		reject(__webpack_error__);
	}, "orders");
}).then(() => (orders));
```

It is created once and stored in `__webpack_require__.c`. Requesting it again returns the
already-rejected Promise — no new `<script>`, no network request at all.

**Layer 3 — the module factory is replaced with a thrower.**

```js
const onError = (error) => {
	__webpack_require__.m[id] = () => { throw error; }
	data.p = 0;
};
```

**Layer 4 — shared-scope initialisation is memoised, and it "succeeded".**

```js
const initExternal = (id) => {
	const handleError = (err) => (warn("Initialization of sharing external failed: " + err));
	…
	catch(err) { handleError(err); }
}
…
return initPromises[name] = Promise.all(promises).then(() => (initPromises[name] = 1));
```

The failure is only *warned* about, so from the host's point of view the shared scope
initialised fine, and the result is cached in `initPromises`. Consequence: even after
defeating layers 1–3, a freshly loaded container would never get `init(shareScope)` called,
because that only happens inside `__webpack_require__.I`, which is now a no-op.

### How it was actually solved

Layers 2–4 exist only because Webpack owns the loading. Moving to a runtime remote loader
(task 01.12) removes all three: with `remotes: {}` Webpack never generates a container
reference module, and `container.init()` is called by application code on every attempt.

That leaves layer 1, fixed by creating a **new** `lazy` per attempt:

```tsx
const [ordersKey, setOrdersKey] = useState(0);

const OrdersApp = useMemo(
  () => lazy(loadDynamicRemote("orders", "./OrdersApp")),
  [ordersKey],
);
```

`onRetry` increments the key → new `lazy` → new loader call → new `<script>` → new
`container.init()`. The loader's own error path already deletes the failed URL from its
script cache, so nothing stale survives.

The order of the two tasks matters: 01.9 cannot be finished properly before 01.12.

### Verification (production build, static servers)

| Step | Result |
| --- | --- |
| `/orders` works, then the orders server is stopped and the page reloaded | fallback shown: *Section "Orders" temporary not available* |
| shell navigation during the outage | intact and usable |
| `/shipments` during the orders outage | works normally — failure did not spread |
| orders server restarted, **Retry** pressed, no page reload | new request to `remoteEntry.js` in Network, section rendered |

The error reaching the boundary is now the loader's own — `Network error while loading
script: http://localhost:3001/remoteEntry.js` — rather than Webpack's
`ScriptExternalLoadError`, since Webpack no longer performs the load. `componentDidCatch`
logs it as `[ErrorBoundary] Error in section Orders:`.

The decisive evidence that Retry genuinely retries is the **new network request** after the
button is pressed. A re-render alone would produce no traffic.

---

## Experiment 01.6 — two React copies

### Background: what a hook actually does

The `react` package cannot store state. It is an API surface; the renderer — `react-dom`,
`react-native`, `react-test-renderer` — owns the implementation. So `useState` inside
`react` does not contain hook logic, it forwards the call to whichever renderer is
currently rendering. The pointer to that renderer is a **module-level variable** inside
the `react` package. In React 19.2.8 it is `ReactSharedInternals.H`, and the forwarding
looks like this:

```js
// node_modules/react/cjs/react.development.js
function resolveDispatcher() {
  var dispatcher = ReactSharedInternals.H;
  null === dispatcher && console.error("Invalid hook call. …");
  return dispatcher;                                   // returns null, does not throw
}

exports.useState = function (initialState) {
  return resolveDispatcher().useState(initialState);   // null.useState → TypeError
};
```

`react-dom` fills that variable immediately before calling a component function and clears
it afterwards. It fills the variable **in the copy of `react` that it imported itself**.

A module-level variable is created when the module executes. Execute the same library code
twice and there are two independent variables. One version on disk does not mean one copy
in memory: Webpack inlines the library into each bundle, and when both bundles run in the
same tab, both copies execute.

### What changed

`react` and `react-dom` were removed from the `shared` block of `orders` only, so the
remote bundles and uses its own copy instead of negotiating one through the shared scope:

```js
// config/webpack.config.js — temporary
if (federationConfig.name === 'orders') {
  delete sharedConfig.react;
  delete sharedConfig['react-dom'];
}
```

No application code was modified. `orders/src/pages/OrdersList.tsx` already calls real
hooks (`useState`, `useEffect`), which is what the experiment needs — a component without
hooks would not expose the problem.

### What was expected

A hook-related failure in hosted mode, and a still-working remote in standalone mode.

### What actually happened

**Build output confirms the split before the browser is even opened.** With the experiment
applied, `orders` registers only two shared modules instead of four:

```text
provide shared module (default) react-router-dom@7.18.2
provide shared module (default) react-router@7.18.2
consume shared module (default) react-router-dom@^7.18.2 (singleton)
consume shared module (default) react-router@^7.18.2 (singleton)
```

`react` and `react-dom` are absent from the list entirely — they are compiled straight into
the remote.

**In the browser at `http://localhost:3000/orders`, two different errors appeared in
sequence**, not as alternatives:

```text
Invalid hook call. Hooks can only be called inside of the body of a function component.
This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.
    at resolveDispatcher (react.development.js:519)
    at exports.useState (react.development.js:1264)
    at OrdersList (OrdersList.tsx:17)
```

```text
Uncaught TypeError: Cannot read properties of null (reading 'useState')
    at exports.useState (react.development.js:1264)
    at OrdersList (OrdersList.tsx:17)
```

Followed by React's own suggestion:

```text
An error occurred in the <OrdersList> component.
Consider adding an error boundary to your tree to customize error handling behavior.
```

**Network confirmed two copies were actually downloaded.** The same module, `react/index.js`,
arrived from two different origins:

```text
http://localhost:3001/vendors-…_react_index_js.bundle.js            ← the remote's private copy
http://localhost:3002/vendors-…_react_index_js.bundle.js            ← the shared singleton copy
http://localhost:3001/vendors-…_react_jsx-dev-runtime_js.bundle.js  ← and its JSX runtime
```

Two downloads means two module executions, which means two independent
`ReactSharedInternals.H` variables — the crash, visible in the network log rather than
inferred from the stack. Because `orders` no longer participates in the shared scope, it
pulls both `react` and its JSX runtime from its own origin.

Worth noting: the shared copy was served by **`shipments` on port 3002**, not by the host.
The provider of a shared module is decided by version negotiation between all participating
containers; the host is one participant among them, not the automatic owner of the shared
copy.

**Standalone mode kept working.** `http://localhost:3001/` rendered and fetched data
normally throughout. This is the other half of the experiment: unchanged component code
crashes when hosted and works when served on its own, so the defect is not in the component
— it is in how many copies of React are present on the page.

### Why it happened

**Why two messages rather than one.** They are two consecutive steps of a single failure.
`resolveDispatcher()` reads `ReactSharedInternals.H`, finds `null`, prints the readable
diagnostic via `console.error` — and then **returns `null` anyway**, because it does not
throw. Control returns to `exports.useState`, which immediately calls `.useState` on that
`null` and produces the `TypeError`. The friendly message is a warning; the `TypeError` is
the actual crash.

**Why the stack is the proof.** The stack names the exact chain described above:

```text
resolveDispatcher  →  exports.useState  →  OrdersList (OrdersList.tsx:17)
```

Line 17 of `OrdersList.tsx` is `const [orders, setOrders] = useState<Order[]>([])`, the
first hook call in the remote.

**Why a component without hooks kept working.** The same stack shows `OrdersApp`
(`OrdersApp.tsx:15`) rendering `<OrdersList>` successfully before the crash. `OrdersApp`
contains no hooks — it only returns JSX. A JSX element is a plain object tagged with
`$$typeof: Symbol.for('react.element')`, and `Symbol.for` reads from a page-wide global
registry, so the tag produced by one copy of React is literally equal to the tag expected
by the other. Elements cross the copy boundary; hooks do not, because a hook reads a
module-level variable that only its own copy owns.

| Crossing the copy boundary | Works | Reason |
| --- | --- | --- |
| JSX element | yes | plain object, identified through the global `Symbol.for` registry |
| Hook | no | reads a module-level variable filled by the other copy's renderer |
| Context | no | `createContext` produced two distinct key objects |

**Why `singleton` fixes it.** `singleton: true` does not merge two copies — it prevents the
second one from existing. Federation picks one instance for the shared scope and forces
every consumer onto it. One instance means one `ReactSharedInternals.H`, so the dispatcher
written by the renderer is the same one the component reads.

| Configuration | Result |
| --- | --- |
| `react` absent from `shared` | Each build ships its own copy. Hook-free components render, components with hooks crash. |
| `react` shared, `singleton: false` | Multiple versions may coexist if ranges disagree — same crash, but only on some version combinations. |
| `singleton: true` in the host only | The remote does not participate and still uses its own copy. Every build must declare it. |
| `singleton: true` everywhere | One instance, hooks work. |

**Side observation.** Without an Error Boundary the crash unmounted the entire tree,
including the shell navigation — React said as much in the console. This is exactly the
failure mode task 01.9 exists to contain.

### Resolution

`react` and `react-dom` were restored to `shared` with `singleton: true`. The `sharedConfig`
extraction introduced for this experiment was kept, because task 01.7 needs to toggle
`strictVersion` on the same object.

## Experiment 01.7 — requiredVersion, singleton and strictVersion

### Background: three fields that answer three different questions

They are constantly confused because all three sound like they are "about versions". They
are not.

| Field | Answers | Who declares it |
| --- | --- | --- |
| `requiredVersion` | "Which versions will satisfy me?" | the consumer |
| `singleton` | "How many instances may exist at all?" | every participant |
| `strictVersion` | "What to do when no satisfying version was found?" | the consumer |

`requiredVersion` is a *claim by the consumer*, not a statement of what will actually be
used. `singleton` is about instance count, not versions — which is why experiment 01.6
crashed with a single version, `19.2.8`, present twice.

The shared scope stores a **map of versions per package**, not one version:

```js
__webpack_share_scopes__.default = {
  "react-router-dom": {
    "7.18.2": { get: fn, from: "shipments", loaded: false }
  }
}
```

Each container registers its own copies during `init(sharedScope)`. The conflict does not
happen when copies are stored — it happens when a consumer comes to collect one.

| Situation | Outcome |
| --- | --- |
| A satisfying version is on the scope | It is handed over. Console stays silent. |
| No match, `singleton: false` | The consumer falls back to the copy bundled inside its own build. No warning, no error — just two instances. |
| No match, `singleton: true`, `strictVersion: false` | Whatever is on the scope is handed over, plus a `console.warn`. Execution continues. |
| No match, `singleton: true`, `strictVersion: true` | `throw` — the shared module fails to load. |

### Setup

`react-router-dom` was used as the test subject, with the version requirement **simulated
rather than installed**: `orders` declared a requirement it could not be satisfied with,
while every package remained on `react-router-dom@7.18.2`.

```js
// config/webpack.config.js — temporary, orders only
if (federationConfig.name === 'orders') {
  sharedConfig['react-router-dom'] = {
    singleton: <toggled>,
    requiredVersion: '^6.0.0',
    strictVersion: <toggled>,
  };
}
```

React itself was deliberately avoided here: mismatched React majors produce the hook crash
from 01.6, which would mask the version diagnostics, and `react-dom` / `react-router` are
pinned to React's major, so the experiment would stop having a single variable.

### The three runs

| Run | `singleton` | `strictVersion` | Result |
| --- | --- | --- | --- |
| A | `true` | `false` | warning, application keeps working |
| B | `true` | `true` | `Uncaught Error`, shared module fails to load |
| C | `false` | — | complete silence, application keeps working |

**Run A — soft mode.** Yellow `console.warn`, rendering unaffected:

```text
Unsatisfied version 7.18.2 from shipments of shared singleton module react-router-dom
(required ^6.0.0)
```

**Run B — strict mode.** Same message, thrown instead of logged:

```text
Uncaught Error: Unsatisfied version 7.18.2 from shipments of shared singleton module
react-router-dom (required ^6.0.0)
```

**Run C — no singleton.** No error and no warning at all. Network showed several
`react-router-dom` requests, all of them version 7.18.2.

### Why it happened

**Why run C is silent.** This is the least intuitive result and the main takeaway:
*mismatched versions are not an event by themselves.* Without `singleton`, the consumer is
free to fall back to the copy bundled in its own build, everyone gets what they asked for,
and there is nothing to complain about. The system only objects once **we** demand a single
instance — that forces it to pick one winner, and the loser necessarily receives a version
it did not request.

**Why run C did not break the router.** The expectation was a context error: if `orders`
uses its own `react-router-dom`, its `<Routes>` should fail to find the shell's
`<BrowserRouter>`. It did not, because `react-router` is declared as a *separate* singleton
and was left untouched. In v7 `react-router-dom` is a thin re-export layer and the contexts
live in `react-router`:

```text
orders → own copy of react-router-dom (3.9 KB) ─┐
                                                 ├─► ONE shared react-router (singleton)
shell  → own copy of react-router-dom (3.9 KB) ─┘         └── one set of contexts
```

Measured on the production build: the `react-router-dom` chunk is 3 941 bytes while
`react-router` is 190 780 bytes. Two copies of the wrapper both delegate into a single
implementation, so a single router context survives.

Had `react-router` not been added to `shared` earlier in this lab, run C would have taken
the application down. The experiment retroactively justified that change.

**Why "all of them 7.18.2" is the correct reading of the Network tab.** Only one version was
ever installed. What differed between the requests was the **copy**, not the version — the
same distinction that made 01.6 crash.

### Honest limitation of this setup

No second major version was installed; the requirement was simulated. Therefore this
experiment demonstrates:

- `requiredVersion` is a consumer-side claim, not a fact;
- `singleton` forces one winner for everybody;
- `strictVersion` decides whether a mismatch is a warning or a refusal to load.

It does **not** demonstrate how the scope behaves when two genuinely different versions are
registered in it. Only `7.18.2` was ever on the scope, so the winner was determined
trivially.

### Side observation: the host is not the provider

Both here and in 01.6 the shared copy was supplied by **`shipments`** — the message reads
`from shipments`, and in 01.6 the shared React chunk was downloaded from port 3002. The
provider of a shared module is decided by negotiation between all participating containers.
Being the host grants no priority.

### Resolution

The temporary `orders` override was removed and `react-router-dom` returned to
`singleton: true` with `requiredVersion` read from the package's own `dependencies`.

## Runtime remote configuration

### The problem with build-time URLs

Originally the host resolved remotes at build time:

```js
remotes: {
  orders: "orders@http://localhost:3001/remoteEntry.js"
}
```

One `dist` of the shell could then only ever talk to one set of remotes. The same artifact
cannot be promoted through dev → test → production, which is exactly what Lab 06 requires of
a container image.

Both `shell/webpack.dev.js` and `shell/webpack.prod.js` now declare `remotes: {}`. Webpack
knows nothing about the remotes at build time.

### The three pieces

**1. `shell/public/mfe-config.json`** — a plain static file, not a source module. It is
copied into `dist` by `copy-webpack-plugin` and served next to `index.html`:

```json
{
  "orders": "http://localhost:3001/remoteEntry.js",
  "shipments": "http://localhost:3002/remoteEntry.js"
}
```

The copy step is guarded so the shared factory does not break the two remotes, which have no
`public` directory:

```js
...(fs.existsSync(path.resolve(appDirectory, 'public'))
  ? [new CopyWebpackPlugin({ patterns: [{ from: path.resolve(appDirectory, 'public'), to: '.' }] })]
  : []),
```

**2. `shell/src/index.ts`** — the config must be in memory before any application code runs,
so the entry fetches it first and only then crosses the async boundary:

```ts
fetch('/mfe-config.json')
  .then((res) => { if (!res.ok) throw new Error('Failed to load runtime MFE config'); return res.json(); })
  .then((config) => {
    window.MFE_CONFIG = config;
    import('./bootstrap');
  })
  .catch((err) => { /* visible failure, not a blank page */ });
```

The dynamic `import('./bootstrap')` still performs its original job from 01.3 — giving the
federation runtime time to initialise the shared scope — and now additionally guarantees the
config is present before any remote is requested.

**3. `shell/src/utils/dynamicRemote.ts`** — the loader, which returns the function shape
`React.lazy` expects:

```ts
loadDynamicRemote(remoteName, moduleName): () => Promise<{ default: ComponentType }>
```

Five steps inside:

| Step | What it does | Previously done by |
| --- | --- | --- |
| 1 | read the URL from `window.MFE_CONFIG` | baked into the bundle |
| 2 | create a `<script>`, wait for `onload` | `webpack/container/reference/orders` |
| 3 | read the container off `window[remoteName]` | Webpack |
| 4 | `__webpack_init_sharing__('default')` then `container.init(__webpack_share_scopes__.default)` | `initExternal` |
| 5 | `container.get(moduleName)` → factory → `factory()` | Webpack |

Step 3 is why `ModuleFederationPlugin`'s `name` must be globally unique: the container
registers itself as a global under exactly that name.

Step 4 is the one that unlocked the Retry button. Under static remotes this handshake happens
once inside a memoised `__webpack_require__.I`; here it is ordinary application code that can
run again on every attempt.

### Required cases

| Case named in the assignment | Where |
| --- | --- |
| network error | `script.onerror` → `script.remove()`, drop from cache, reject |
| container missing after load | explicit check of `window[remoteName]`, throws with a readable message |
| repeated shared-scope initialisation | `init` wrapped in `try/catch`, logged rather than fatal |
| the same script added twice | a module-level `Map<url, Promise>` de-duplicates concurrent requests |

### Deviation from the assignment's wording

The assignment describes *promise-based remotes*: hand Webpack a fake container through
`remotes: { orders: "promise new Promise(...)" }` and let Webpack drive `get` and `init`.
This implementation instead declares `remotes: {}` and calls `init`/`get` from application
code, passing the result to `React.lazy`.

Both satisfy the acceptance criteria — the URL is not baked into the bundle and one build
works with different runtime configs. The reason for choosing this variant is concrete:
with promise-based remotes Webpack still owns the module cache and the memoised
`initPromises`, which are layers 2 and 4 of the Retry problem documented under
[Error isolation](#error-isolation). Taking over the loading is what made the Retry button
possible.

### Acceptance test

Performed against the production build with static servers:

1. `shell/dist` built once.
2. A second copy of `orders/dist` served on port **3005**.
3. Only `shell/dist/mfe-config.json` edited — `3001` → `3005`.
4. Page reloaded. **No rebuild.**

Result: `remoteEntry.js` was requested from `localhost:3005`, no requests went to `3001`, and
the Orders section worked normally. One build, different runtime configuration.

Note the file that must be edited is the one in `dist`, not the source in `public` — editing
the source would prove nothing without a rebuild, and the absence of a rebuild is the whole
point.

---

## Network verification results

Measured against the **production** build served by static servers, DevTools Network with
*Disable cache* enabled. Procedure: load `/`, hard-reload, clear the log, navigate to
`/orders`, record, and only then navigate to `/shipments`.

| While on | Requests to `:3001` (orders) | Requests to `:3002` (shipments) |
| --- | --- | --- |
| `/` | none | none |
| `/orders` | `remoteEntry.js` + 1 chunk | **none** |
| then `/shipments` | unchanged | `remoteEntry.js` + 1 chunk |

Nothing belonging to `shipments` is fetched while the user is on `/orders`, and each remote
costs exactly one manifest request plus one chunk when it is first needed.

Note that `remoteEntry.js` itself is deferred, not just the component chunk. With statically
declared remotes the host initialises every container during shared-scope setup, so the
manifests are typically fetched up front and only the component code is lazy. Because loading
is driven by the runtime loader from task 01.12, a remote is untouched until its route is
entered — the stronger of the two behaviours the assignment describes.

Chunk loading also confirms `publicPath: 'auto'`: every remote asset is requested from the
remote's own origin, never from the host on `:3000`.

---

## Dev/prod divergence found during acceptance

Worth recording separately, because it only appeared in the production build and is the
reason task 22 exists as its own acceptance step.

**Symptom.** The dev server worked perfectly. The production `dist`, served statically, threw
on every page:

```text
Uncaught (in promise) TypeError: (0 , d.jsxDEV) is not a function
```

**Cause.** Babel and Webpack disagreed about the build mode. The factory declared the JSX
transform without stating a mode:

```js
['@babel/preset-react', { runtime: 'automatic' }]
```

`@babel/preset-react` then takes its `development` flag from the environment — `BABEL_ENV`,
then `NODE_ENV`, defaulting to `"development"` when neither is set. Running
`webpack --config webpack.prod.js` sets neither: `mode: 'production'` configures Webpack and
the code inside the bundle, not the environment of the Node process Babel reads.

So Babel emitted development JSX calls:

```js
var d = r(421);            // react/jsx-dev-runtime
… (0, d.jsxDEV)("p", …)
```

while Webpack defined `NODE_ENV = "production"`, which makes React resolve that entry point to
its production build — where the export exists but is deliberately empty:

```js
// react/cjs/react-jsx-dev-runtime.production.js
exports.jsxDEV = void 0;
```

Half the build was development, half production.

**Fix.** State the mode explicitly, from the same `mode` Webpack already receives:

```js
['@babel/preset-react', { runtime: 'automatic', development: !isProd }]
```

**Verification.** Before: `jsxDEV` referenced in 7 chunks across the three `dist` folders.
After: zero, and all three builds emit `jsx` / `jsxs` from `react/jsx-runtime` instead.

The lesson is the one the assignment states — a working dev server proves nothing about the
built artifact, and this class of defect is only reachable by building and serving statically.

---

## Known limitations

- Types are not shared between applications. The remote contract is hand-written — now as the
  return type of `loadDynamicRemote` — and nothing verifies it against the real remote.
- `shared` fallbacks are duplicated in every `dist`. This is by design, but it means bundle
  size on disk is not a measure of whether sharing works.
- Chunk IDs are unstable across builds and must not be referenced anywhere but in ad-hoc
  inspection.
- The loader's handling of an already-present `<script>` tag resolves as soon as the tag is
  found rather than waiting for its `load` event. The in-memory `Map` de-duplicates every
  request this application actually makes, so the branch is effectively unreachable, but it
  would be wrong if a tag were injected by something else.
- Remote URLs are configurable at runtime, but the config is fetched from the host's own
  origin with no schema validation and no fallback if a URL is malformed.
- Task 01.13 (the same host on the Vite MF plugin) has not been attempted.
