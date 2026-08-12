import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ShipmentsApp from "./ShipmentsApp";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element #root was not found");
}

const root = createRoot(container);
root.render(
  <BrowserRouter>
    <ShipmentsApp />
  </BrowserRouter>,
);
