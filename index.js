const { port, proxyConfig, staticDir, indexFile } = require("./config");
const Corrosion = require("./lib/server");
const express = require("express");

const app = express();

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

// Serve the main index page
app.get("/", (req, res) => {
  res.sendFile(indexFile);
});

// All other requests are proxied
app.use("/", (req, res) => {
  proxy.request(req, res);
});

app.listen(process.env.PORT || port, () => {
  console.log(`A portal has appeared over at http://localhost:${port}`);
});
