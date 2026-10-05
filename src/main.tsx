import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/luckiest-guy/400.css";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/auth.tsx";
import { NativeShell } from "./components/NativeShell.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NativeShell />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
