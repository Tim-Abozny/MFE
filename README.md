# Monorepository Architecture, Build Factory, and Express API (Laboratory Work 1)

This repository contains a ready-to-use infrastructure for building microfrontends. The project is organized as a monorepository that unites isolated frontend applications, a local shared design system, and a backend server for data processing.

## 🚀 Key Features Implemented

### 1. Architecture & Dependency Management

- **pnpm workspaces**: Configured a unified workspace to manage 5 independent packages (`shell`, `orders`, `shipments`, `api`, `ds`) with a single root `node_modules` and smart symlinking.
- **Local Design System (`ds`)**: Created an independent package that shares common constants, styles, and TypeScript types with frontend applications using the local resolution mechanism (`workspace:*`).

### 2. Unified Build Factory (Webpack 5 + TypeScript 5/7)

- **Centralized Configurator**: Built a single Webpack configuration factory function (`config/webpack.config.js`). It completely eliminated code duplication across individual application folders.
- **Babel Integration**: Integrated `babel-loader` directly into the factory with presets for automatic parsing of modern JavaScript, TypeScript compilation, and React 19 JSX syntax.
- **Environment Separation**: The factory supports two execution modes:
  - `development`: Enables fast Source Maps (`eval-source-map`) and a local development server (`webpack-dev-server`) with Hot Module Replacement (HMR).
  - `production`: Fully optimizes and minifies the final `bundle.js` asset for production deployment.
- **Port Isolation**: Isolated all frontend applications on unique ports to prevent networking conflicts: `shell` (3000), `orders` (3001), and `shipments` (3002).

### 3. Fault-Tolerant REST API (Express + Node.js)

- The backend server runs on port `4000` and is executed via the modern, high-performance `tsx` loader.
- Implemented runtime in-memory mock data generation using `Array.from()` and `Math.random` (no external database required).
- **Business Logic for the `/orders` Endpoint**:
  - Supports dynamic server-side filtering via the `status` query parameter.
  - Implemented server-side pagination (`page` and `size`) using array slicing via `.slice()`.
  - Included a large dataset generator feature (`?seed=N`), capable of generating and processing up to 10,000 objects on the fly upon client request.
- **Global Express Middlewares**:
  - Network Latency Simulation: Artificially delays incoming requests by a random time between 300 and 600 ms to mirror real-world API behaviors.
  - Forced Error Trigger: Intercepts the `x-force-status` header and immediately aborts execution to return HTTP `401` or `500` status codes for fault-tolerance testing.

### 4. Development Automation

- Configured the `concurrently` utility at the workspace root.
- Executing **`pnpm dev`** launches all 4 active applications simultaneously in a single terminal window, appending custom color-coded name tags to each service's log output.

---

## 🛠️ Project Structure

```text
MFE/
├── config/                  # Global build configurations
│   └── webpack.config.js    # Centralized Webpack factory
├── ds/                      # Local Design System (Shared package)
├── shell/                   # Main frontend host application (Port 3000)
├── orders/                  # Orders microfrontend application (Port 3001)
├── shipments/               # Shipments microfrontend application (Port 3002)
├── api/                     # Express backend API server (Port 4000)
├── tsconfig.base.json       # Shared base TypeScript configuration
├── pnpm-workspace.yaml      # pnpm workspaces definition
└── package.json             # Root package file managing concurrently scripts
```

---

## 💻 Quick Start

1. Install the entire monorepository dependencies (run this in the root directory):
   ```bash
   pnpm install
   ```
2. Launch all services concurrently with a single command:
   ```bash
   pnpm dev
   ```
3. Open the main frontend application in your browser: `http://localhost:3000`
4. Test the backend endpoints using any REST client or browser: `http://localhost:4000/orders?seed=10000&status=shipped&page=2&size=5`
