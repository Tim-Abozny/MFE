import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

interface Shipment {
  id: number;
  orderId: number;
  trakingNumber: string;
  carrier: string;
  estimatedDelivery: string;
}

export default function ShipmentDetails() {
  const { trackId } = useParams<{ trackId: string }>();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/shipments")
      .then((res) => res.json())
      .then((data: Shipment[]) => {
        const found = data.find((s) => s.id === Number(trackId));
        setShipment(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [trackId]);

  if (loading) return <p>Loading tracking parameters...</p>;
  if (!shipment) return <p>Shipment information not found!</p>;

  return (
    <div
      style={{
        padding: "15px",
        backgroundColor: "#fdf5fd",
        borderRadius: "8px",
      }}
    >
      <h3>📦 Shipment Status #{shipment.id}</h3>
      <p>
        <b>Related Order:</b> Order #{shipment.orderId}
      </p>
      <p>
        <b>Carrier:</b> {shipment.carrier}
      </p>
      <p>
        <b>Tracking Number:</b>{" "}
        <code style={{ backgroundColor: "#eee", padding: "2px 6px" }}>
          {shipment.trakingNumber}
        </code>
      </p>
      <p>
        <b>Estimated Delivery Date:</b> {shipment.estimatedDelivery}
      </p>
      <hr />
      <Link to="/shipments" style={{ color: "#666666" }}>
        ← Back to List
      </Link>
    </div>
  );
}
