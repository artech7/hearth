const fs = require("fs");

const server = fs.readFileSync("server.js", "utf8");

// Text assets go in verbatim; binaries are base64 so the bundle stays valid JS.
const TEXT = ["/index.html", "/styles.css", "/app.js", "/site.webmanifest", "/favicon.svg"];
const BINARY = ["/favicon-16.png", "/favicon-32.png", "/favicon-48.png",
                "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const typeOf = name => TYPES[name.slice(name.lastIndexOf("."))] || "application/octet-stream";

const entries = [];
for (const name of TEXT) {
  entries.push(`  ${JSON.stringify(name)}: { type: ${JSON.stringify(typeOf(name))}, body: ${
    JSON.stringify(fs.readFileSync("public" + name, "utf8"))} },`);
}
for (const name of BINARY) {
  entries.push(`  ${JSON.stringify(name)}: { type: ${JSON.stringify(typeOf(name))}, b64: ${
    JSON.stringify(fs.readFileSync("public" + name).toString("base64"))} },`);
}

const embed = `const ASSETS = {\n${entries.join("\n")}\n};`;

const newServe = `function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const asset = ASSETS[rel];
  if (!asset) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("not found"); }
  const body = asset.b64 ? Buffer.from(asset.b64, "base64") : asset.body;
  res.writeHead(200, {
    "Content-Type": asset.type,
    "Cache-Control": "no-cache",
    "ETag": \`"\${VERSION}"\`,
  });
  res.end(body);
}

`;

const start = server.indexOf("function serveStatic");
const end = server.indexOf("const num = (v, min, max, fallback)");
if (start === -1 || end === -1) throw new Error("build: could not locate serveStatic");

let out = server.slice(0, start) + newServe + server.slice(end);
out = out.replace('const PUBLIC_DIR = path.join(__dirname, "public");', embed);

const warnStart = out.indexOf("  if (!fs.existsSync(path.join(PUBLIC_DIR");
if (warnStart === -1) throw new Error("build: could not find the PUBLIC_DIR warning block to strip");
const warnEnd = out.indexOf("  }\n});", warnStart) + "  }\n".length;
out = out.slice(0, warnStart) + out.slice(warnEnd);

fs.writeFileSync("hearth.js", out);
console.log("built hearth.js:", (out.length / 1024).toFixed(0) + " KB");
