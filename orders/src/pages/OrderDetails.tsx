import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

interface Order {
  id: number;
  name: string;
  status: string;
  total: number;
}

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/orders?page=1&size=30")
      .then((res) => res.json())
      .then((data) => {
        const found = data.items.find(
          (item: Order) => item.id === Number(orderId),
        );
        setOrder(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orderId]);

  if (loading) return <p>Loading order details from Server ...</p>;
  if (!order) return <p>Order not found!</p>;

  return (
    <div
      style={{
        padding: "15px",
        backgroundColor: "#f4f9f4",
        borderRadius: "8px",
      }}
    >
      <h3>📄 Order details #{order.id}</h3>
      <p>
        <b>Client:</b> {order.name}
      </p>
      <p>
        <b>Pay sum:</b> {order.total} USD
      </p>
      <p>
        <b>Current status:</b>{" "}
        <span style={{ color: "green" }}>{order.status}</span>
      </p>
      <hr />
      <Link to="/orders" style={{ color: "#666666" }}>
        ← Back to List
      </Link>
    </div>
  );
}
