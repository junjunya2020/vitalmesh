import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHomeAssistantPlatform } from "../../platform/homeassistant/index.js";
import { createMcpPlatform } from "../../platform/mcp/index.js";
import { chinaNow } from "../../src/core/time.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.VITALMESH_HA_DATA_DIR ?? path.join(rootDir, "data");
const dbFile = process.env.VITALMESH_HA_DB ?? path.join(dataDir, "gateway.json");
const rawLogFile = process.env.VITALMESH_HA_RAW_LOG ?? path.join(dataDir, "accepted-webhooks.ndjson");
const host = process.env.HA_COMPAT_HOST ?? "127.0.0.1";
const port = Number(process.env.HA_COMPAT_PORT ?? 8123);
const token = process.env.VITALMESH_HA_TOKEN ?? "dev-vitalmesh-token";

export const createServer = (options = {}) => {
  const selectedDbFile = options.dbFile ?? (options.rawLogFile
    ? path.join(path.dirname(options.rawLogFile), "gateway.sqlite3")
    : dbFile);
  const selectedRawLogFile = options.rawLogFile ?? (selectedDbFile === dbFile
    ? rawLogFile
    : path.join(path.dirname(selectedDbFile), "accepted-webhooks.ndjson"));
  const platform = createHomeAssistantPlatform({
    dbFile: selectedDbFile,
    rawLogFile: selectedRawLogFile,
    token: options.token ?? token
  });
  const mcp = createMcpPlatform({ store: platform.store, token: options.token ?? token });
  const server = http.createServer(async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const requestId = crypto.randomBytes(6).toString("hex");
    res.on("finish", () => console.log(JSON.stringify({
      type: "access", request_id: requestId, time: chinaNow(),
      remote: req.socket.remoteAddress ?? "unknown", method: req.method, path: req.url,
      status: res.statusCode, duration_ms: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)),
      user_agent: req.headers["user-agent"] ?? null
    })));
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      const result = await platform.handleHttp(req, url) ?? await mcp.handle(req, url);
      if (result) return result(res);
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ message: "Not found" }));
    } catch (error) {
      console.error(JSON.stringify({ type: "request_error", request_id: requestId, method: req.method, path: req.url, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null }));
      if (!res.headersSent) { res.writeHead(400, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ message: error instanceof Error ? error.message : "Bad request" })); }
    }
  });
  platform.attachWebSocket(server);
  server.on("close", () => platform.close());
  return server;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, host, () => {
    console.log(`VitalMesh HA compatibility gateway listening on http://${host}:${port}`);
    console.log(token === "" ? "WARNING: authentication disabled because VITALMESH_HA_TOKEN is empty" : "Authentication enabled");
  });
}
