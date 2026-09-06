import crypto from "node:crypto";

const protocolVersion = "2025-06-18";
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const tools = [
  { name: "list_devices", description: "列出所有已接入的手机和其他数据设备", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_sensors", description: "列出指定设备提供的全部传感器", inputSchema: { type: "object", properties: { device_id: { type: "string", description: "设备 ID" } }, required: ["device_id"], additionalProperties: false } },
  { name: "get_sensor_latest", description: "查看指定设备的某个传感器最新数据", inputSchema: { type: "object", properties: { device_id: { type: "string" }, sensor_id: { type: "string" } }, required: ["device_id", "sensor_id"], additionalProperties: false } },
  { name: "get_sensor_history", description: "分页查看指定设备某个传感器的历史数据", inputSchema: { type: "object", properties: { device_id: { type: "string" }, sensor_id: { type: "string" }, page: { type: "integer", minimum: 1, default: 1 }, page_size: { type: "integer", minimum: 1, maximum: 200, default: 50 } }, required: ["device_id", "sensor_id"], additionalProperties: false } }
];

const result = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false });
const errorResult = (message) => ({ content: [{ type: "text", text: message }], isError: true });

export const createMcpPlatform = ({ store, token = "" }) => {
  const sessions = new Map();
  const authorized = (req) => token === "" || req.headers.authorization === `Bearer ${token}`;
  const rpc = (request) => {
    if (!request || request.jsonrpc !== "2.0" || request.id === undefined) return null;
    if (request.method === "initialize") return { jsonrpc: "2.0", id: request.id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "vitalmesh", version: "0.1.0" } } };
    if (request.method === "ping") return { jsonrpc: "2.0", id: request.id, result: {} };
    if (request.method === "tools/list") return { jsonrpc: "2.0", id: request.id, result: { tools } };
    if (request.method !== "tools/call") return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Method not found: ${request.method}` } };
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    try {
      let value;
      if (name === "list_devices") value = { devices: store.listDevices() };
      else if (name === "list_sensors") {
        if (!args.device_id) return { jsonrpc: "2.0", id: request.id, result: errorResult("device_id 为必填参数") };
        value = { device_id: args.device_id, sensors: store.listSensors(args.device_id) };
      } else if (name === "get_sensor_latest") {
        if (!args.device_id || !args.sensor_id) return { jsonrpc: "2.0", id: request.id, result: errorResult("device_id 和 sensor_id 都是必填参数") };
        const sensor = store.getSensor(args.sensor_id, args.device_id);
        if (!sensor) return { jsonrpc: "2.0", id: request.id, result: errorResult("找不到指定设备下的传感器") };
        value = sensor;
      } else if (name === "get_sensor_history") {
        if (!args.device_id || !args.sensor_id) return { jsonrpc: "2.0", id: request.id, result: errorResult("device_id 和 sensor_id 都是必填参数") };
        const page = Math.max(1, Number(args.page ?? 1));
        const pageSize = Math.min(200, Math.max(1, Number(args.page_size ?? 50)));
        if (!Number.isInteger(page) || !Number.isInteger(pageSize)) return { jsonrpc: "2.0", id: request.id, result: errorResult("page 和 page_size 必须是整数") };
        value = { device_id: args.device_id, sensor_id: args.sensor_id, ...store.historyPage(args.sensor_id, args.device_id, page, pageSize) };
      } else return { jsonrpc: "2.0", id: request.id, error: { code: -32602, message: `Unknown tool: ${name}` } };
      return { jsonrpc: "2.0", id: request.id, result: result(value) };
    } catch (error) {
      return { jsonrpc: "2.0", id: request.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
    }
  };
  const sendSse = (res, message) => { res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`); };
  const openSse = (res, endpointPath = "/messages") => {
    const sessionId = crypto.randomUUID();
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write(`event: endpoint\ndata: ${endpointPath}?session_id=${encodeURIComponent(sessionId)}\n\n`);
    sessions.set(sessionId, res);
    res.on("close", () => sessions.delete(sessionId));
    return sessionId;
  };
  const handle = async (req, url) => {
    if (!url.pathname.startsWith("/mcp") && !url.pathname.startsWith("/sse") && !url.pathname.startsWith("/messages")) return null;
    if (!authorized(req)) return (res) => json(res, 401, { error: "Invalid authentication" });
    if (req.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) return (res) => { openSse(res, url.pathname === "/sse" ? "/messages" : "/mcp"); };
    if (req.method === "DELETE" && url.pathname === "/mcp") return (res) => res.writeHead(204).end();
    if (req.method !== "POST" || (url.pathname !== "/mcp" && url.pathname !== "/messages")) return null;
    const request = await readJson(req);
    const response = rpc(request);
    if (!response) return (res) => res.writeHead(202).end();
    const sessionId = url.searchParams.get("session_id");
    if (url.pathname === "/messages" && sessionId && sessions.has(sessionId)) {
      sendSse(sessions.get(sessionId), response);
      return (res) => res.writeHead(202).end();
    }
    return (res) => json(res, 200, response);
  };
  return { handle };
};
