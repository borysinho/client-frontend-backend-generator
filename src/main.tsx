import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";

// Single Page Apps for GitHub Pages
// https://github.com/rafgraph/spa-github-pages
// This script checks to see if a redirect is present in the query string,
// converts it back to the correct url and adds it to the
// browser's history using window.history.replaceState(...),
// which won't cause the browser to attempt to load the new url.
// When the single page app is loaded further down in this file,
// the correct url will be waiting in the browser's history for
// the single page app to route accordingly.
(function (l: Location) {
  if (l.search[1] === "/") {
    const decoded = l.search
      .slice(1)
      .split("&")
      .map(function (s) {
        return s.replace(/~and~/g, "&");
      })
      .join("?");
    window.history.replaceState(
      null as any,
      "", // eslint-disable-line @typescript-eslint/no-explicit-any
      l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
})(window.location);

createRoot(document.getElementById("root")!).render(
  <Router basename="/client-frontend-backend-generator">
    <App />
  </Router>
);
