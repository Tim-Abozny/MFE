import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface Order {
  id: number;
  name: string;
  status: string;
  total: number;
}

interface ApiResponse {
  items: Order[];
  total: number;
}

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/orders?page=1&size=30")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        setOrders(data.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading data from API Server ...</p>;
  }

  return (
    <div>
      <h3>Live Orders List</h3>
      <ul>
        {orders.map((order) => (
          <li key={order.id} style={{ margin: "10px 0" }}>
            <Link
              to={`${order.id}`}
              style={{
                color: "green",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Order #{order.id} — {order.name}
            </Link>
            <span style={{ marginLeft: "10px", color: "#666" }}>
              ({order.total} $, status: <b>{order.status}</b>)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
