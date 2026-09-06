/*
METADATA
{
  "name": "vitalmesh_ha",
  "display_name": {
    "zh": "VitalMesh 健康查詢",
    "en": "VitalMesh Health Query"
  },
  "description": {
    "zh": "包內自動啟動 VitalMesh 後端（node bundle），並提供 4 個健康數據查詢工具：list_devices、list_sensors、get_sensor_latest、get_sensor_history。啟動後端用 start_server。",
    "en": "Auto-start the VitalMesh backend in-package and provide 4 health query tools: list_devices, list_sensors, get_sensor_latest, get_sensor_history. Use start_server to launch the backend."
  },
  "category": "Health",
  "tools": [
    {
      "name": "start_server",
      "description": "啟動 VitalMesh 後端服務（已啟動則跳過）。部署到 proot 並以 node 啟動，綁定 0.0.0.0:8123。",
      "parameters": []
    },
    {
      "name": "list_devices",
      "description": "列出所有已接入的手機和其他數據設備",
      "parameters": []
    },
    {
      "name": "list_sensors",
      "description": "列出指定設備提供的全部感測器",
      "parameters": [
        { "name": "device_id", "description": "設備 ID", "type": "string", "required": true }
      ]
    },
    {
      "name": "get_sensor_latest",
      "description": "查看指定設備的某個感測器最新數據",
      "parameters": [
        { "name": "device_id", "description": "設備 ID", "type": "string", "required": true },
        { "name": "sensor_id", "description": "感測器 ID", "type": "string", "required": true }
      ]
    },
    {
      "name": "get_sensor_history",
      "description": "分頁查看指定設備某個感測器的歷史數據",
      "parameters": [
        { "name": "device_id", "description": "設備 ID", "type": "string", "required": true },
        { "name": "sensor_id", "description": "感測器 ID", "type": "string", "required": true },
        { "name": "page", "description": "頁碼（預設 1）", "type": "integer", "required": false },
        { "name": "page_size", "description": "每頁筆數（預設 50，最大 200）", "type": "integer", "required": false }
      ]
    }
  ]
}
*/
/**
 * VitalMesh 健康查詢子包（vitalmesh_ha）
 *
 * 兩大功能：
 *   A) start_server：包內自動啟動後端（對齊 netease_listen 成功模式）
 *      - Tools.System.terminal.create('vitalmesh') 建立 proot 終端會話
 *      - 把 bundle.cjs / entry.cjs / better_sqlite3.node / node_modules 部署到 /home/ubuntu/vitalmesh/
 *      - `cd /home/ubuntu/vitalmesh && (nohup node entry.cjs > server.log 2>&1 &)`
 *      - 後端監聽 0.0.0.0:8123，側邊欄 WebView 直連
 *   B) 4 個健康查詢工具（與後端 MCP server 完全一致）：
 *      list_devices / list_sensors / get_sensor_latest / get_sensor_history
 */
const common = require('../shared/vitalmesh_common.js');

/* ============ A) 後端自動啟動（netease_listen 模式）============ */

/** proot 部署目錄（netease 用 /home/ubuntu，proot Ubuntu 的 home） */
const SERVER_DIR = '/home/ubuntu/vitalmesh-runtime';
/** 後端綁定埠 */
const PORT = 8123;
/** 後端 base URL */
const BASE = 'http://127.0.0.1:' + PORT;

/** 唯一資源 key：完整 runtime（Node + backend + native module） */
const RES_RUNTIME = 'runtime_bundle';
/** 唯一包內 Node 路徑 */
const NODE_BIN = SERVER_DIR + '/node/bin/node';
/** 唯一後端入口 */
const ENTRY = SERVER_DIR + '/backend/entry.cjs';

let _sid = null;
async function ensureSession() {
  if (_sid) return _sid;
  try {
    const s = await Tools.System.terminal.create('vitalmesh');
    _sid = (s && (s.sessionId || s.sessionName || s.id)) || 'vitalmesh';
  } catch (e) {
    _sid = 'vitalmesh';
  }
  return _sid;
}

/** 在 proot 終端執行命令並返回輸出 */
async function sh(command, timeoutMs) {
  const sid = await ensureSession();
  const r = await Tools.System.terminal.exec(sid, command, timeoutMs || 15000);
  return r;
}

function bodyOf(r) {
  if (r === null || r === undefined) return '';
  if (typeof r === 'string') return r;
  if (r.output !== undefined) return r.output;
  if (r.body !== undefined) return r.body;
  if (r.content !== undefined) return r.content;
  if (r.result !== undefined) return r.result;
  if (r.data !== undefined) return r.data;
  return r;
}

/** 後端是否已運行：用 TCP 實測本機 127.0.0.1:8123。 */
async function isUp() {
  try {
    const result = await sh("if timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1:" + PORT + "' 2>/dev/null; then echo PORT_OPEN; else echo PORT_CLOSED; fi", 6000);
    const output = String(bodyOf(result) || '');
    return output.indexOf('PORT_OPEN') >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * 唯一部署動作：讀取一個 runtime.tar.gz，完整解壓一次。
 * 包含 Node v20、backend bundle、node_modules、better-sqlite3 原生模組。
 */
async function deployServer(force) {
  const checkFiles = [ENTRY, NODE_BIN, SERVER_DIR + '/backend/build/Release/better_sqlite3.node'];
  if (!force) {
    try {
      const c = await sh('n=0; for f in ' + checkFiles.join(' ') + '; do [ -s "$f" ] && n=$((n+1)); done; echo $n', 10000);
      if (parseInt(String(bodyOf(c) || '').trim(), 10) >= 3) return false;
    } catch (e) {}
  }

  let runtimePath = '';
  try {
    runtimePath = await ToolPkg.readResource(RES_RUNTIME, 'vitalmesh-runtime.tar.gz', false);
  } catch (e) {
    runtimePath = '';
  }
  if (!runtimePath) throw new Error('無法讀取唯一 runtime 資源，請重裝插件');

  // 只複製一個壓縮包、只解壓一次，避免 Node/backend 半部署。
  await sh('rm -rf ' + SERVER_DIR + ' && mkdir -p ' + SERVER_DIR + ' && cp ' + runtimePath + ' ' + SERVER_DIR + '/runtime.tar.gz', 60000);
  await sh('cd ' + SERVER_DIR + ' && tar xzf runtime.tar.gz && rm -f runtime.tar.gz && chmod +x node/bin/node backend/entry.cjs backend/bundle.cjs 2>/dev/null', 120000);
  const verify = await sh('echo "NODE=$(' + NODE_BIN + ' -v 2>&1)"; n=0; for f in ' + checkFiles.join(' ') + '; do [ -s "$f" ] && n=$((n+1)); done; echo "FILES=$n"; if [ "$n" -eq 3 ]; then cd ' + SERVER_DIR + ' && HA_COMPAT_HOST=0.0.0.0 HA_COMPAT_PORT=' + PORT + ' VITALMESH_HA_TOKEN= setsid nohup ' + NODE_BIN + ' ' + ENTRY + ' > server.log 2>&1 < /dev/null & echo SERVER_START_REQUESTED; else echo SERVER_START_SKIPPED; fi', 30000);
  const output = String(bodyOf(verify) || '');
  if (!/FILES=3/.test(output)) throw new Error('runtime 解壓驗證失敗: ' + output);
  if (!/SERVER_START_REQUESTED/.test(output)) throw new Error('runtime 驗證完成但未送出後端啟動命令: ' + output);
  return true;
}

/** 啟動後端（主入口） */
async function start_server() {
  // 已運行則直接返回
  if (await isUp()) {
    return { success: true, message: 'VitalMesh 後端已在運行', url: BASE + '/' };
  }

  // 部署（若已部署則跳過）
  try {
    await deployServer(false);
  } catch (e) {
    return { success: false, message: '後端部署失敗: ' + (e && e.message ? e.message : String(e)) };
  }

  // deployServer 已在同一個終端命令中發出啟動；成功後不要再殺掉它。
  await new Promise(function (res) { setTimeout(res, 2000); });
  if (await isUp()) {
    const log = await sh('tail -10 ' + SERVER_DIR + '/server.log', 6000);
    return { success: true, message: 'VitalMesh 後端已啟動', url: BASE + '/', log: bodyOf(log) };
  }

  // 備用啟動：只有部署後端沒有成功監聽時才執行。
  try {
    await sh("pkill -f 'node entry.cjs' 2>/dev/null; pkill -f 'node bundle.cjs' 2>/dev/null; sleep 0.5; echo cleaned", 8000);
  } catch (e) { /* 無舊進程 */ }

  const cmd = 'cd ' + SERVER_DIR + " && (HA_COMPAT_HOST=0.0.0.0 HA_COMPAT_PORT=" + PORT + " VITALMESH_HA_TOKEN= setsid nohup " + NODE_BIN + " " + ENTRY + " > server.log 2>&1 < /dev/null &) ; sleep 2; echo BOOTED";
  await sh(cmd, 10000);

  // 等待就緒（最多 ~8 秒）
  for (let i = 0; i < 8; i++) {
    if (await isUp()) {
      const log = await sh('tail -5 ' + SERVER_DIR + '/server.log', 6000);
      return { success: true, message: 'VitalMesh 後端已啟動', url: BASE + '/', log: bodyOf(log) };
    }
    await new Promise(function (res) { setTimeout(res, 1000); });
  }

  const log = await sh('tail -20 ' + SERVER_DIR + '/server.log', 6000);
  return { success: false, message: '後端啟動逾時（8123 未就緒）', log: bodyOf(log) };
}

/* ============ B) 4 個健康查詢工具 ============ */

/** 讀取 secret 並組成後端位址 */
async function resolveBackend() {
  const secret = await common.readSecret();
  const baseUrl = secret && secret.backendUrl ? secret.backendUrl : BASE;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token: secret && secret.token ? secret.token : '',
  };
}

/** 讀取 REST API 回應內容，兼容 Tools.Net 的不同回傳格式。 */
function responseBody(response) {
  if (response === null || response === undefined) return null;
  if (typeof response === 'string') {
    try { return JSON.parse(response); } catch (e) { return response; }
  }
  if (response.data !== undefined) return response.data;
  if (response.body !== undefined) {
    if (typeof response.body === 'string') {
      try { return JSON.parse(response.body); } catch (e) { return response.body; }
    }
    return response.body;
  }
  if (response.content !== undefined) {
    if (typeof response.content === 'string') {
      try { return JSON.parse(response.content); } catch (e) { return response.content; }
    }
    return response.content;
  }
  return response;
}

/** 呼叫本機 REST API，不經 MCP。tool 包預設無 token。 */
async function restGet(path) {
  try {
    const response = await Tools.Net.httpGet(BASE + path);
    return { success: true, data: responseBody(response) };
  } catch (e) {
    return { success: false, message: 'HTTP 錯誤: ' + (e && e.message ? e.message : String(e)) };
  }
}

async function dashboardData() {
  return await restGet('/api/vitalmesh/dashboard');
}

/**
 * 舊 MCP 相容層：保留 VPS 部署版及舊後端的 /mcp JSON-RPC 呼叫。
 * 本機版先走 REST，REST 失敗時自動回退到此方法。
 */
async function mcpCall(toolName, args) {
  const { baseUrl, token } = await resolveBackend();
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args || {} }
  };
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await Tools.Net.httpPost(baseUrl + '/mcp', body, headers);
    const parsed = responseBody(response);
    if (!parsed) return { success: false, message: 'MCP 無回應' };
    if (parsed.error) return { success: false, message: parsed.error.message || 'MCP 呼叫失敗' };
    const result = parsed.result || {};
    if (result.isError) {
      const item = result.content && result.content[0];
      return { success: false, message: item && item.text ? item.text : 'MCP 工具執行失敗' };
    }
    if (result.structuredContent !== undefined) return { success: true, data: result.structuredContent };
    const text = result.content && result.content[0] ? result.content[0].text : '';
    try { return { success: true, data: JSON.parse(text) }; }
    catch (e) { return { success: true, data: text }; }
  } catch (e) {
    return { success: false, message: 'MCP HTTP 錯誤: ' + (e && e.message ? e.message : String(e)) };
  }
}

/** REST 優先，REST 失敗時回退舊 MCP；兩種後端協議均相容。 */
async function restOrMcp(toolName, args, restResolver) {
  const rest = await restResolver();
  if (rest && rest.success && rest.data !== null && rest.data !== undefined) return rest;
  return await mcpCall(toolName, args);
}

/** 工具 1：列出所有設備 */
async function listDevices() {
  return await restOrMcp('list_devices', {}, async function () {
    const result = await dashboardData();
    if (!result.success) return result;
    return { success: true, data: result.data && result.data.devices ? result.data.devices : result.data };
  });
}

/** 工具 2：列出指定設備的感測器（REST 優先，失敗回退 MCP） */
async function listSensors(params) {
  if (!params || !params.device_id) {
    return { success: false, message: '缺少必填參數 device_id' };
  }
  return await restOrMcp('list_sensors', { device_id: params.device_id }, async function () {
    const result = await dashboardData();
    if (!result.success || !result.data) return result;
    const sensors = Array.isArray(result.data.sensors) ? result.data.sensors : [];
    return {
      success: true,
      data: sensors.filter(function (item) { return item.device_id === params.device_id; })
    };
  });
}

/** 工具 3：最新感測器數據（REST 優先，失敗回退 MCP） */
async function getSensorLatest(params) {
  if (!params || !params.device_id || !params.sensor_id) {
    return { success: false, message: '缺少必填參數 device_id / sensor_id' };
  }
  return await restOrMcp('get_sensor_latest', {
    device_id: params.device_id,
    sensor_id: params.sensor_id
  }, async function () {
    const result = await dashboardData();
    if (!result.success || !result.data) return result;
    const sensors = Array.isArray(result.data.sensors) ? result.data.sensors : [];
    const item = sensors.find(function (sensor) {
      return sensor.device_id === params.device_id && sensor.sensor_id === params.sensor_id;
    });
    if (!item) return { success: false, message: '找不到指定感測器' };
    return { success: true, data: item.latest || item };
  });
}

/** 工具 4：感測器歷史數據（REST 優先，失敗回退 MCP） */
async function getSensorHistory(params) {
  if (!params || !params.device_id || !params.sensor_id) {
    return { success: false, message: '缺少必填參數 device_id / sensor_id' };
  }
  const page = params.page !== undefined ? params.page : 1;
  const pageSize = params.page_size !== undefined ? params.page_size : 50;
  return await restOrMcp('get_sensor_history', {
    device_id: params.device_id,
    sensor_id: params.sensor_id,
    page: page,
    page_size: pageSize
  }, async function () {
    const result = await restGet('/api/vitalmesh/sensors/' + encodeURIComponent(params.sensor_id) + '/history');
    if (!result.success || !result.data) return result;
    return {
      success: true,
      data: {
        device_id: params.device_id,
        sensor_id: params.sensor_id,
        page: page,
        page_size: pageSize,
        history: Array.isArray(result.data.history) ? result.data.history : []
      }
    };
  });
}

/* ============ 匯出 ============ */

module.exports = {
  start_server: function (params) { return start_server(params); },
  list_devices: function (params) { return listDevices(params); },
  list_sensors: function (params) { return listSensors(params); },
  get_sensor_latest: function (params) { return getSensorLatest(params); },
  get_sensor_history: function (params) { return getSensorHistory(params); },
};