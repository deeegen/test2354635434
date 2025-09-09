const { port, proxyConfig, staticDir, indexFile } = require("./config");
const Corrosion = require("./lib/server");
const express = require("express");
const path = require("path");

const app = express();

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Create a proxy instance and attach the blacklist middleware at runtime
const proxy = new Corrosion({
  ...proxyConfig,
  requestMiddleware: [
    Corrosion.middleware.blacklist(
      proxyConfig.blacklist,
      proxyConfig.blacklistMessage
    ),
  ],
});

// Serve static files from the configured directory
app.use("/", express.static(staticDir));

// Serve the main index page using EJS
app.get("/", (req, res) => {
  // Strip extension from indexFile in case it has ".html"
  const viewName = path.basename(indexFile, path.extname(indexFile));
  res.render(viewName, { title: "My EJS Page" });
});

// Serve the frame page using EJS
app.get("/frame", (req, res) => {
  res.render("frame", { title: "Frame View" });
});

// All other requests are proxied
app.use("/", (req, res) => {
  proxy.request(req, res);
});

app.listen(process.env.PORT || port, () => {
  console.log(`A portal has appeared over at http://localhost:${port}`);
});
