// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
const parse5 = require("parse5");

/**
 * Try to read a server-side config one directory up (../config).
 * This is optional and done safely — it will not throw in a browser
 * because we guard the require by checking typeof require.
 *
 * We accept either:
 *  - module.exports = { title: '...' }
 *  - module.exports = { proxyConfig: { title: '...' } }
 *
 * If neither exist (or the title is empty), externalConfigTitle will be undefined
 * and the rewriter will preserve the proxied page's title.
 */
let externalConfigTitle;
(function loadExternalTitle() {
  try {
    if (typeof require === "function") {
      // Node environment: try to require ../config
      const cfg = require("../config");
      if (cfg) {
        if (typeof cfg.title === "string" && cfg.title.trim().length) {
          externalConfigTitle = cfg.title;
          return;
        }
        if (
          cfg.proxyConfig &&
          typeof cfg.proxyConfig.title === "string" &&
          cfg.proxyConfig.title.trim().length
        ) {
          externalConfigTitle = cfg.proxyConfig.title;
          return;
        }
      }
    }
  } catch (e) {
    // ignore — we'll just fallback to ctx config or proxied title
    externalConfigTitle = undefined;
  }

  // Allow a client-side override if a bundler injects a global config (non-invasive)
  try {
    if (typeof window !== "undefined" && !externalConfigTitle) {
      const winCfg =
        window.__CORROSION_CONFIG__ || window.CORROSION_CONFIG || null;
      if (winCfg) {
        if (typeof winCfg.title === "string" && winCfg.title.trim().length) {
          externalConfigTitle = winCfg.title;
          return;
        }
        if (
          winCfg.proxyConfig &&
          typeof winCfg.proxyConfig.title === "string" &&
          winCfg.proxyConfig.title.trim().length
        ) {
          externalConfigTitle = winCfg.proxyConfig.title;
          return;
        }
      }
    }
  } catch (e) {
    /* noop */
  }
})();

class HTMLRewriter {
  constructor(ctx) {
    this.ctx = ctx;
    this.attrs = [
      {
        tags: [
          "form",
          "object",
          "a",
          "link",
          "area",
          "base",
          "script",
          "img",
          "audio",
          "video",
          "input",
          "embed",
          "iframe",
          "track",
          "source",
          "html",
          "table",
          "head",
        ],
        attrs: [
          "src",
          "href",
          "ping",
          "data",
          "movie",
          "action",
          "poster",
          "profile",
          "background",
          "target",
        ],
        handler: "url",
      },
      {
        tags: ["iframe"],
        attrs: ["srcdoc"],
        handler: "html",
      },
      {
        tags: ["img", "link", "source"],
        attrs: ["srcset", "imagesrcset"],
        handler: "srcset",
      },
      {
        tags: "*",
        attrs: ["style"],
        handler: "css",
      },
      {
        tags: "*",
        attrs: ["http-equiv", "integrity", "nonce", "crossorigin"],
        handler: "delete",
      },
    ];
  }
  process(source, config = {}) {
    const ast = parse5[config.document ? "parse" : "parseFragment"](source);
    const meta = {
      origin: config.origin,
      base: new URL(config.base),
    };
    iterate(ast, (node) => {
      if (!node.tagName) return;
      switch (node.tagName) {
        case "STYLE":
          if (node.textContent)
            node.textContent = this.ctx.css.process(node.textContent, meta);
          break;
        case "TITLE": {
          // Overwrite all <title> elements when an explicit title is provided.
          // Priority:
          //   1) externalConfigTitle (../config.js or injected global)
          //   2) this.ctx.config.title (previous behavior)
          //   3) otherwise leave the proxied page's title intact (fallback)
          const overrideFromExternal =
            typeof externalConfigTitle === "string" &&
            externalConfigTitle.length
              ? externalConfigTitle
              : undefined;
          const ctxTitle =
            this.ctx &&
            this.ctx.config &&
            typeof this.ctx.config.title === "string" &&
            this.ctx.config.title.length
              ? this.ctx.config.title
              : undefined;
          const chosen =
            typeof overrideFromExternal !== "undefined"
              ? overrideFromExternal
              : ctxTitle;
          if (typeof chosen === "string" && chosen.length) {
            node.textContent = chosen;
          }
          break;
        }
        case "SCRIPT":
          if (
            node.getAttribute("type") != "application/json" &&
            node.textContent
          )
            node.textContent = this.ctx.js.process(node.textContent);
          break;
        case "BASE":
          if (node.hasAttribute("href"))
            meta.base = new URL(node.getAttribute("href"), config.base);
          break;
      }
      node.attrs.forEach((attr) => {
        const handler = this.attributeRoute({
          ...attr,
          node,
        });
        let flags = [];
        if (node.tagName == "SCRIPT" && attr.name == "src") flags.push("js");
        if (node.tagName == "LINK" && node.getAttribute("rel") == "stylesheet")
          flags.push("css");
        switch (handler) {
          case "url":
            node.setAttribute(`corrosion-${attr.name}`, attr.value);
            attr.value = this.ctx.url.wrap(attr.value, { ...meta, flags });
            break;
          case "srcset":
            node.setAttribute(`corrosion-${attr.name}`, attr.value);
            attr.value = this.srcset(attr.value, meta);
            break;
          case "css":
            attr.value = this.ctx.css.process(attr.value, {
              ...meta,
              context: "declarationList",
            });
            break;
          case "html":
            node.setAttribute(`corrosion-${attr.name}`, attr.value);
            attr.value = this.process(attr.value, { ...config, ...meta });
            break;
          case "delete":
            node.removeAttribute(attr.name);
            break;
        }
      });
    });
    if (config.document) {
      for (let i in ast.childNodes)
        if (ast.childNodes[i].tagName == "html")
          ast.childNodes[i].childNodes.forEach((node) => {
            if (node.tagName == "head") {
              node.childNodes.unshift(...this.injectHead(config.base));
            }
          });
    }
    return parse5.serialize(ast);
  }
  source(processed, config = {}) {
    const ast = parse5[config.document ? "parse" : "parseFragment"](processed);
    iterate(ast, (node) => {
      if (!node.tagName) return;
      node.attrs.forEach((attr) => {
        if (node.hasAttribute(`corrosion-${attr.name}`)) {
          attr.value = node.getAttribute(`corrosion-${attr.name}`);
          node.removeAttribute(`corrosion-${attr.name}`);
        }
      });
    });
    return parse5.serialize(ast);
  }
  injectHead() {
    // Determine an override title to inject (if any).
    // Priority:
    //   1) externalConfigTitle (../config.js or injected global)
    //   2) this.ctx.config.title
    // If neither exists or both are empty -> do not inject a title element (allow proxied page to keep its title).
    const overrideTitle =
      typeof externalConfigTitle === "string" && externalConfigTitle.length
        ? externalConfigTitle
        : this.ctx &&
          this.ctx.config &&
          typeof this.ctx.config.title === "string" &&
          this.ctx.config.title.length
        ? this.ctx.config.title
        : undefined;

    // Compute the title literal to embed into the inline script for the client.
    // If override is defined we embed it (string or boolean). Otherwise embed undefined
    // so the client-side corrosion can decide to use proxied page title.
    let serverChosenTitle =
      typeof externalConfigTitle !== "undefined"
        ? externalConfigTitle
        : this.ctx && this.ctx.config
        ? this.ctx.config.title
        : undefined;
    let jsTitleLiteral;
    if (typeof serverChosenTitle === "boolean") {
      jsTitleLiteral = String(serverChosenTitle);
    } else if (typeof serverChosenTitle === "string") {
      jsTitleLiteral = "'" + serverChosenTitle.replace(/'/g, "\\'") + "'";
    } else {
      jsTitleLiteral = "undefined";
    }

    // Safely stringify codec and prefix for injection (escape single quotes).
    const safeCodec =
      this.ctx && this.ctx.config && typeof this.ctx.config.codec === "string"
        ? this.ctx.config.codec.replace(/'/g, "\\'")
        : "plain";
    const safePrefix =
      this.ctx && this.ctx.prefix
        ? String(this.ctx.prefix).replace(/'/g, "\\'")
        : "";
    // Note: ws and cookie are injected as raw JS literals (true/false/undefined/null)
    const wsLiteral =
      this.ctx && this.ctx.config && typeof this.ctx.config.ws !== "undefined"
        ? JSON.stringify(this.ctx.config.ws)
        : "undefined";
    const cookieLiteral =
      this.ctx &&
      this.ctx.config &&
      typeof this.ctx.config.cookie !== "undefined"
        ? JSON.stringify(this.ctx.config.cookie)
        : "undefined";

    const nodes = [];

    if (typeof overrideTitle !== "undefined") {
      nodes.push({
        nodeName: "title",
        tagName: "title",
        childNodes: [
          {
            nodeName: "#text",
            value: overrideTitle,
          },
        ],
        attrs: [],
      });
    }

    nodes.push({
      nodeName: "script",
      tagName: "script",
      childNodes: [],
      attrs: [
        {
          name: "src",
          value: this.ctx.prefix + "index.js",
        },
      ],
    });

    nodes.push({
      nodeName: "script",
      tagName: "script",
      childNodes: [
        {
          nodeName: "#text",
          value: `window.$corrosion = new Corrosion({ window, codec: '${safeCodec}',  prefix: '${safePrefix}', ws: ${wsLiteral}, cookie: ${cookieLiteral}, title: ${jsTitleLiteral}, }); $corrosion.init(); document.currentScript.remove();`,
        },
      ],
      attrs: [],
    });

    return nodes;
  }
  attributeRoute(data) {
    const match = this.attrs.find(
      (entry) =>
        (entry.tags == "*" && entry.attrs.includes(data.name)) ||
        (entry.tags.includes(data.node.tagName.toLowerCase()) &&
          entry.attrs.includes(data.name))
    );
    return match ? match.handler : false;
  }
  srcset(val, config = {}) {
    return val
      .split(",")
      .map((src) => {
        const parts = src.trimStart().split(" ");
        if (parts[0]) parts[0] = this.ctx.url.wrap(parts[0], config);
        return parts.join(" ");
      })
      .join(", ");
  }
  unsrcset(val, config = {}) {
    return val
      .split(",")
      .map((src) => {
        const parts = src.trimStart().split(" ");
        if (parts[0]) parts[0] = this.ctx.url.unwrap(parts[0], config);
        return parts.join(" ");
      })
      .join(", ");
  }
}

class Parse5Wrapper {
  constructor(node) {
    this.raw = node || {
      attrs: [],
      childNodes: [],
      namespaceURI: "",
      nodeName: "",
      parentNode: {},
      tagName: "",
    };
  }
  hasAttribute(name) {
    return this.raw.attrs.some((attr) => attr.name == name);
  }
  removeAttribute(name) {
    if (!this.hasAttribute(name)) return;
    this.raw.attrs.splice(
      this.raw.attrs.findIndex((attr) => attr.name == name),
      1
    );
  }
  setAttribute(name, val = "") {
    if (!name) return;
    this.removeAttribute(name);
    this.raw.attrs.push({
      name: name,
      value: val,
    });
  }
  getAttribute(name) {
    return (this.raw.attrs.find((attr) => attr.name == name) || { value: null })
      .value;
  }
  get textContent() {
    return (
      this.raw.childNodes.find((node) => node.nodeName == "#text") || {
        value: "",
      }
    ).value;
  }
  set textContent(val) {
    if (this.raw.childNodes.some((node) => node.nodeName == "#text"))
      return (this.raw.childNodes[
        this.raw.childNodes.findIndex((node) => node.nodeName == "#text")
      ].value = val);
    this.raw.childNodes.push({
      nodeName: "#text",
      value: val,
    });
  }
  get tagName() {
    return (this.raw.tagName || "").toUpperCase();
  }
  get nodeName() {
    return this.raw.nodeName;
  }
  get parentNode() {
    return this.raw.parentNode;
  }
  get childNodes() {
    return this.raw.childNodes || [];
  }
  get attrs() {
    return this.raw.attrs || [];
  }
}

function iterate(ast, fn = (node = Parse5Wrapper.prototype) => null) {
  fn(new Parse5Wrapper(ast));
  if (ast.childNodes)
    for (let i in ast.childNodes) iterate(ast.childNodes[i], fn);
}

module.exports = HTMLRewriter;
