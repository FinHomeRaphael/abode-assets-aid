import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply dark mode from localStorage before render to avoid flash
const theme = localStorage.getItem('finehome_theme');
if (theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// Prevent scroll wheel from changing number input values
document.addEventListener('wheel', (e) => {
  const el = document.activeElement;
  if (el && el instanceof HTMLInputElement && el.type === 'number') {
    el.blur();
  }
}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
