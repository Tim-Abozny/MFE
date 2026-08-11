import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { THEME, getWelcomeMessage } from "@mfe/ds";

const OrdersApp = lazy(() => import("orders/OrdersApp"));
const ShipmentsApp = lazy(() => import("shipments/ShipmentsApp"));

const Home = () => (
  <div
    style={{
      backgroundColor: "#ffffff",
      padding: THEME.padding,
      borderRadius: THEME.borderRadius,
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
      textAlign: "center",
    }}
  >
    <h2 style={{ color: THEME.primaryColor, marginTop: 0 }}>
      Welcome to the Platform
    </h2>
    <p style={{ color: "#333333" }}>{getWelcomeMessage("Shell Host")}</p>
  </div>
);

const ShellLayout = () => {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        backgroundColor: THEME.backgroundColor,
        minHeight: "100vh",
      }}
    >
      <nav
        style={{
          backgroundColor: "#ffffff",
          padding: "15px 30px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          display: "flex",
          gap: "20px",
        }}
      >
        <NavLink
          to="/"
          style={({ isActive }) => ({
            color: isActive ? THEME.primaryColor : "#333333",
            fontWeight: isActive ? "bold" : "normal",
            textDecoration: "none",
          })}
        >
          Home
        </NavLink>

        <NavLink
          to="/orders"
          style={({ isActive }) => ({
            color: isActive ? THEME.primaryColor : "#333333",
            fontWeight: isActive ? "bold" : "normal",
            textDecoration: "none",
          })}
        >
          Orders
        </NavLink>

        <NavLink
          to="/shipments"
          style={({ isActive }) => ({
            color: isActive ? THEME.primaryColor : "#333333",
            fontWeight: isActive ? "bold" : "normal",
            textDecoration: "none",
          })}
        >
          Shipments
        </NavLink>
      </nav>

      <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/orders/*"
            element={
              <Suspense
                fallback={
                  <p style={{ color: "green", textAlign: "center" }}>
                    Loading Orders Section…
                  </p>
                }
              >
                <OrdersApp />
              </Suspense>
            }
          />

          <Route
            path="/shipments/*"
            element={
              <Suspense
                fallback={
                  <p style={{ color: "magenta", textAlign: "center" }}>
                    Loading Shipments Section…
                  </p>
                }
              >
                <ShipmentsApp />
              </Suspense>
            }
          />
        </Routes>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ShellLayout />
    </BrowserRouter>
  );
}
