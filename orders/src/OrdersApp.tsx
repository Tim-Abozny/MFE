import { Routes, Route } from "react-router-dom";
import OrdersList from "./pages/OrdersList";
import OrderDetails from "./pages/OrderDetails";

export default function OrdersApp() {
  return (
    <div
      style={{
        padding: "16px",
        border: "2px dashed green",
        borderRadius: "8px",
      }}
    >
      <Routes>
        <Route index element={<OrdersList />} />
        <Route path=":orderId" element={<OrderDetails />} />
      </Routes>
    </div>
  );
}
