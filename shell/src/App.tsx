// shell/src/App.tsx
import { THEME, getWelcomeMessage } from "@mfe/ds";

const OrdersAppPromise = import("orders/OrdersApp");

export default function App() {
  return (
    <div
      style={{
        backgroundColor: THEME.backgroundColor,
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: THEME.padding,
          borderRadius: THEME.borderRadius,
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          maxWidth: "500px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: THEME.primaryColor, marginTop: 0 }}>
          Shell Application
        </h1>
        <p style={{ color: "#333333", lineHeight: "1.5" }}>
          {getWelcomeMessage("Shell")}
        </p>
      </div>
    </div>
  );
}
