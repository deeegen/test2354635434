module.exports = {
  port: "8080",

  proxyConfig: {
    prefix: "/app/",
    codec: "xor",

    // Title override for proxied pages:
    // - If set to a non-empty string, this will replace ALL <title> elements.
    // - If left empty ("" or undefined), the proxied page's original title will be preserved.
    title: "Portal",

    forceHttps: true,

    // Blacklist configuration is now just data
    blacklist: ["accounts.google.com"],
    blacklistMessage: "Page is blocked",
  },

  // Static file serving
  staticDir: __dirname + "/public",
  indexFile: __dirname + "/public/index.ejs",
};
