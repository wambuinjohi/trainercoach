import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Enable auto-login in development environment
if (import.meta.env.DEV && !localStorage.getItem('auto_login_enabled')) {
  localStorage.setItem('auto_login_enabled', 'true');
}

// Global error handlers
window.addEventListener('error', (event) => {
  // Global error handler
});

window.addEventListener('unhandledrejection', (event) => {
  // Unhandled promise rejection handler
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  document.body.innerHTML = "<div style='padding: 20px; color: red;'>Error: Root element not found in DOM</div>";
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    document.body.innerHTML = `<div style='padding: 20px; color: red; font-family: monospace;'>Error mounting app: ${error}</div>`;
  }
}
