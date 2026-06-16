import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";
import { TokenGate } from "./components/TokenGate";

// Defined at build time by vite.config.web.ts; false/undefined in Tauri builds.
const IS_WEB = import.meta.env.VITE_BUILD_TARGET === "web";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    {IS_WEB && <TokenGate />}
  </React.StrictMode>,
);
