import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import OrdersApp from "./OrdersApp";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element #root was not found");
}

const root = createRoot(container);
root.render(
  <BrowserRouter>
    <OrdersApp />
  </BrowserRouter>,
);
