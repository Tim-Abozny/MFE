import { Routes, Route } from "react-router-dom";
import ShipmentsList from "./pages/ShipmentsList";
import ShipmentDetails from "./pages/ShipmentDetails";

export default function ShipmentsApp() {
  return (
    <div
      style={{
        padding: "16px",
        border: "2px dashed magenta",
        borderRadius: "8px",
      }}
    >
      <Routes>
        <Route index element={<ShipmentsList />} />
        <Route path=":trackId" element={<ShipmentDetails />} />
      </Routes>
    </div>
  );
}
