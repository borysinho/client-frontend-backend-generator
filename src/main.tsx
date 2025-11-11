import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Invitations from "./pages/Invitations";
import InvitationPage from "./pages/InvitationPage";
import DiagramEditor from "./pages/DiagramEditor";

// Determine basename based on environment
const getBasename = () => {
  // Check if we're on Vercel (production) or GitHub Pages
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Vercel uses different hostnames, GitHub Pages uses github.io
    if (hostname !== "borysinho.github.io") {
      return "/"; // Vercel - use root
    }
  }
  return "/client-frontend-backend-generator"; // GitHub Pages
};

// Handle client-side routing for GitHub Pages SPA
const handleGitHubPagesRouting = () => {
  const basename = getBasename();
  if (basename === "/client-frontend-backend-generator") {
    const path = window.location.search.slice(1); // Remove the leading '?'
    if (path && path.startsWith("/")) {
      // Replace the current URL with the path from the query string
      const newPath = path.replace(/^\/client-frontend-backend-generator/, "");
      window.history.replaceState(
        null,
        "",
        "/client-frontend-backend-generator" + newPath
      );
    }
  }
};

// Call the routing handler
handleGitHubPagesRouting();

createRoot(document.getElementById("root")!).render(
  <Router basename={getBasename()}>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/invitations" element={<Invitations />} />
      <Route path="/invitation/:invitationId" element={<InvitationPage />} />
      <Route path="/diagrams" element={<DiagramEditor />} />
      <Route path="/diagrams/:id" element={<DiagramEditor />} />
    </Routes>
  </Router>
);
