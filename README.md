# MFE — microfrontend platform

A microfrontend portal built from scratch: a pnpm monorepo, a hand-written Webpack 5 build
factory, Module Federation between independently deployable applications, and an Express
mock backend. No starter templates — every configuration file is written by hand, because
the point of the exercise is to know what each line does.

```text
                       shell : 3000  (host)
                         │
        ┌────────────────┴────────────────┐
        │                                 │
   orders : 3001                    shipments : 3002
     (remote)                          (remote)
        │                                 │
        └────────────┬────────────────────┘
                     │
                api : 4000  (Express mock backend)
```

## Packages

| Package | Role | Port |
| --- | --- | ---: |
| `shell` | host application, owns top-level routing | 3000 |
| `orders` | orders microfrontend, exposes `./OrdersApp` | 3001 |
| `shipments` | shipments microfrontend, exposes `./ShipmentsApp` | 3002 |
| `api` | Express mock API — pagination, filters, latency, forced errors | 4000 |
| `ds` | local design system, linked via `workspace:*` | — |

```text
MFE/
├── config/
│   ├── webpack.config.js    # single build factory for all three frontends
│   └── template.html        # shared HTML template
├── docs/                    # per-lab write-ups
├── shell/  orders/  shipments/  api/  ds/
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

## Quick start

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

Individual services:

```bash
pnpm --filter @mfe/orders start        # one app in dev
pnpm --filter @mfe/orders build        # production build into orders/dist
pnpm --filter @mfe/orders typecheck    # tsc --noEmit; the build itself never runs tsc
```

## Stack

pnpm workspaces · Webpack 5 · ModuleFederationPlugin · Babel · TypeScript · React 19 ·
React Router 7 · Express 5

## Lab write-ups

The project grows one lab at a time. Each write-up records what was built, which
experiments were run, and what the actual output was — including the deliberate breakages,
which are part of the exercise rather than accidents.

| Lab | Topic | Status |
| --- | --- | --- |
| [Lab 00](docs/lab-00.md) | Monorepo skeleton, build factory, mock API | Complete |
| [Lab 01](docs/lab-01.md) | Module Federation: host, two remotes, shared dependencies | Complete (bonus 01.13 not attempted) |

Lab 01 covers runtime remote resolution, per-remote error isolation with a Retry that
genuinely reloads the remote, and three deliberate breakages recorded with their real console
output: [eager consumption](docs/lab-01.md#experiment-013--synchronous-entry-point),
[two React copies](docs/lab-01.md#experiment-016--two-react-copies), and
[version negotiation](docs/lab-01.md#experiment-017--requiredversion-singleton-and-strictversion).
Everything was re-verified against the production build served statically, which is where a
[Babel/Webpack mode mismatch](docs/lab-01.md#devprod-divergence-found-during-acceptance)
surfaced that the dev server had hidden.
