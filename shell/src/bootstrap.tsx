import { createRoot } from "react-dom/client";
import App from "./App";

const container =
  document.getElementById("root") || document.createElement("div");

if (!container.id) {
  container.id = "root";
  document.body.appendChild(container);
}

const root = createRoot(container);
root.render(<App />);
