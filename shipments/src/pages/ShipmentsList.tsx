import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface Shipment {
  id: number;
  orderId: number;
  trakingNumber: string;
  carrier: string;
  estimatedDelivery: string;
}

export default function ShipmentsList() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/shipments")
      .then((res) => res.json())
      .then((data: Shipment[]) => {
        setShipments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading shipments...</p>;

  return (
    <div>
      <h3>Live Shipment Tracking (Express API)</h3>
      <ul>
        {shipments.map((s) => (
          <li key={s.id} style={{ margin: "10px 0" }}>
            <Link
              to={`${s.id}`}
              style={{
                color: "magenta",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Shipment for Order #{s.orderId} ({s.carrier})
            </Link>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#666" }}>
              Track-number: {s.trakingNumber}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
