#!/usr/bin/env node
/**
 * Standalone server for the Understand Anything dashboard.
 *
 * Serves the prebuilt dashboard in ./dashboard/ plus the six data endpoints the
 * app fetches. Replaces the Vite dev server's `serve-knowledge-graph` middleware
 * so the dashboard runs without Claude Code, the plugin, or any npm install.
 *
 * Node built-ins only — there is no node_modules and nothing to install.
 *
 *   node serve.mjs [--port 5173] [--token <token>]
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.join(HERE, "dashboard");

// The graph lives beside this script; the project it describes is one level up.
// GRAPH_DIR overrides the project root, matching the dev server's contract.
const GRAPH_DIR = process.env.GRAPH_DIR ? path.resolve(process.env.GRAPH_DIR) : path.dirname(HERE);
const GRAPH_HOME = process.env.GRAPH_DIR ? path.join(GRAPH_DIR, ".understand-anything") : HERE;
const PROJECT_ROOT = path.dirname(GRAPH_HOME);

const MAX_SOURCE_FILE_BYTES = 1024 * 1024;

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const ACCESS_TOKEN =
  argValue("--token") || process.env.UNDERSTAND_ACCESS_TOKEN || crypto.randomBytes(16).toString("hex");
const START_PORT = Number(argValue("--port") || process.env.PORT || 5173);
const HOST = "127.0.0.1";

const PROTECTED = new Set([
  "/knowledge-graph.json",
  "/domain-graph.json",
  "/diff-overlay.json",
  "/meta.json",
  "/config.json",
  "/file-content.json",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const graphFile = (fileName) => path.join(GRAPH_HOME, fileName);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

const reject = (message, statusCode = 400) => ({ statusCode, payload: { error: message } });

/** Strip the project root off node filePaths so the host's directory layout is not exposed. */
function relativiseNodePaths(raw) {
  if (!Array.isArray(raw.nodes)) return raw;
  raw.nodes = raw.nodes.map((node) => {
    if (typeof node.filePath !== "string") return node;
    const abs = node.filePath;
    const rel = abs.startsWith(PROJECT_ROOT)
      ? abs.slice(PROJECT_ROOT.length).replace(/^[\\/]/, "")
      : path.isAbsolute(abs)
        ? path.basename(abs)
        : abs;
    return { ...node, filePath: rel };
  });
  return raw;
}

function normalizeGraphPath(filePath) {
  const rawPath = path.isAbsolute(filePath)
    ? filePath.startsWith(PROJECT_ROOT)
      ? path.relative(PROJECT_ROOT, filePath)
      : null
    : filePath;
  if (rawPath === null) return null;
  const normalized = path.normalize(rawPath);
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("\0") ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized.split(path.sep).join("/");
}

/**
 * The set of paths the code viewer may read. Only files that are nodes in the
 * graph are readable — the graph doubles as the allowlist, so this endpoint
 * cannot be walked into arbitrary parts of the disk.
 */
function graphFilePathSet() {
  const allowed = new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(graphFile("knowledge-graph.json"), "utf-8"));
    for (const node of raw.nodes ?? []) {
      if (typeof node.filePath !== "string") continue;
      const normalized = normalizeGraphPath(node.filePath);
      if (normalized) allowed.add(normalized);
    }
  } catch {
    return allowed;
  }
  return allowed;
}

function detectLanguage(filePath) {
  const byExt = {
    bash: "bash", c: "c", cc: "cpp", cpp: "cpp", cs: "csharp", css: "css",
    go: "go", h: "c", hpp: "cpp", html: "markup", java: "java", js: "javascript",
    jsx: "jsx", json: "json", md: "markdown", mjs: "javascript", py: "python",
    rb: "ruby", rs: "rust", sh: "bash", ts: "typescript", tsx: "tsx",
    txt: "text", yaml: "yaml", yml: "yaml",
  };
  return byExt[path.extname(filePath).slice(1).toLowerCase()] ?? "text";
}

function readSourceFile(url) {
  const requestedPath = url.searchParams.get("path") ?? "";
  if (!requestedPath) return reject("Missing path");
  if (requestedPath.includes("\0")) return reject("Invalid path");
  if (path.isAbsolute(requestedPath)) return reject("Absolute paths are not allowed");

  const normalizedPath = path.normalize(requestedPath);
  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalizedPath)
  ) {
    return reject("Path must stay inside the project");
  }

  if (!fs.existsSync(graphFile("knowledge-graph.json"))) {
    return reject("No knowledge graph found. Run /understand first.", 404);
  }

  const absoluteFile = path.resolve(PROJECT_ROOT, normalizedPath);
  const relativeToRoot = path.relative(PROJECT_ROOT, absoluteFile);
  if (
    !relativeToRoot ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return reject("Path must stay inside the project");
  }

  const safeRelativePath = relativeToRoot.split(path.sep).join("/");
  if (!graphFilePathSet().has(safeRelativePath)) {
    return reject("File is not in the knowledge graph", 404);
  }

  let stat;
  try {
    stat = fs.statSync(absoluteFile);
  } catch {
    return reject("File not found", 404);
  }
  if (!stat.isFile()) return reject("Path is not a file");
  if (stat.size > MAX_SOURCE_FILE_BYTES) return reject("File is too large to preview", 413);

  const buffer = fs.readFileSync(absoluteFile);
  if (buffer.includes(0)) return reject("Binary files cannot be previewed", 415);

  const content = buffer.toString("utf8");
  return {
    statusCode: 200,
    payload: {
      path: safeRelativePath,
      language: detectLanguage(relativeToRoot),
      content,
      sizeBytes: buffer.byteLength,
      lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
    },
  };
}

function serveStatic(pathname, res) {
  // Any unknown route falls back to index.html so the SPA can route it.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(STATIC_ROOT, rel);

  // Never serve outside the built dashboard directory.
  const insideRoot = candidate === STATIC_ROOT || candidate.startsWith(STATIC_ROOT + path.sep);
  const file =
    insideRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(STATIC_ROOT, "index.html");

  if (!fs.existsSync(file)) {
    res.statusCode = 500;
    res.end("Dashboard build missing. Expected " + STATIC_ROOT);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const pathname = url.pathname;

  if (!PROTECTED.has(pathname)) {
    serveStatic(pathname, res);
    return;
  }

  // Data endpoints require the one-time token. The code viewer can read project
  // source, so an unguarded port would expose the repo to anything on this machine.
  if (url.searchParams.get("token") !== ACCESS_TOKEN) {
    sendJson(res, 403, { error: "Forbidden: missing or invalid token" });
    return;
  }

  if (pathname === "/file-content.json") {
    const result = readSourceFile(url);
    sendJson(res, result.statusCode, result.payload);
    return;
  }

  if (pathname === "/config.json") {
    const candidate = graphFile("config.json");
    if (fs.existsSync(candidate)) {
      try {
        sendJson(res, 200, JSON.parse(fs.readFileSync(candidate, "utf-8")));
      } catch {
        sendJson(res, 500, { error: "Failed to read config file" });
      }
      return;
    }
    sendJson(res, 200, { autoUpdate: false, outputLanguage: "en" });
    return;
  }

  const fileName = pathname.slice(1);
  const candidate = graphFile(fileName);
  if (!fs.existsSync(candidate)) {
    if (pathname === "/knowledge-graph.json") {
      sendJson(res, 404, { error: "No knowledge graph found. Run /understand first." });
    } else {
      res.statusCode = 404;
      res.end();
    }
    return;
  }

  try {
    const raw = relativiseNodePaths(JSON.parse(fs.readFileSync(candidate, "utf-8")));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(raw));
  } catch (err) {
    // Refuse to serve rather than leak raw content we could not sanitise.
    console.error("[understand-anything] Failed to read graph file:", err);
    sendJson(res, 500, { error: "Failed to read graph file" });
  }
});

// Step past an occupied port rather than dying on it.
let port = START_PORT;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && port < START_PORT + 20) {
    server.listen(++port, HOST);
    return;
  }
  console.error(err.message);
  process.exit(1);
});

server.listen(port, HOST, () => {
  console.log(`\n  🔑  Dashboard URL: http://${HOST}:${port}/?token=${ACCESS_TOKEN}`);
  console.log(`      Graph:   ${graphFile("knowledge-graph.json")}`);
  console.log(`      Project: ${PROJECT_ROOT}`);
  console.log(`\n      Ctrl+C to stop.\n`);
});
