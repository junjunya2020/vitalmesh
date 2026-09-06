/*
METADATA
{
  "name": "vitalmesh_ha",
  "display_name": {
    "zh": "VitalMesh 健康查詢",
    "en": "VitalMesh Health Query"
  },
  "description": {
    "zh": "使用包內後端原始碼並在首次使用時安裝依賴，提供 4 個健康數據查詢工具：list_devices、list_sensors、get_sensor_latest、get_sensor_history。啟動後端用 start_server。",
    "en": "Install dependencies from the bundled backend source when needed and provide 4 health query tools: list_devices, list_sensors, get_sensor_latest, get_sensor_history. Use start_server to launch the backend."
  },
  "category": "Health",
  "tools": [
    {
      "name": "start_server",
      "description": "確保依賴已安裝並啟動 VitalMesh 後端；若 8123 已有可用服務則直接沿用。",
      "parameters": []
    },
    {
      "name": "uninstall",
      "description": "停止 VitalMesh 服務並移除原始碼與依賴。預設保留使用者健康資料；delete_user_data=true 時才刪除資料。",
      "parameters": [
        { "name": "delete_user_data", "description": "是否刪除健康資料，預設 false", "type": "boolean", "required": false }
      ]
    },
    {
      "name": "install_dependencies",
      "description": "從包內後端原始碼安裝生產依賴（首次啟動會自動呼叫）。",
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
 *   A) install_dependencies / start_server：部署原始碼、安裝生產依賴並啟動後端
 *      - 不內置 Node.js、node_modules 或編譯產物
 *      - 多次並發呼叫共用同一個啟動 Promise
 *      - 既有 8123 服務通過檢查後直接沿用
 *   B) 4 個健康查詢工具（與後端 MCP server 完全一致）：
 *      list_devices / list_sensors / get_sensor_latest / get_sensor_history
 */
const common = require('../shared/vitalmesh_common.js');

/* ============ A) 原始碼部署、依賴安裝與啟動 ============ */
const SERVER_DIR = '/home/ubuntu/vitalmesh-source';
const PORT = 8123;
const BASE = 'http://127.0.0.1:' + PORT;
const RES_SOURCE = 'backend_source_v105';
const SOURCE_ARCHIVE = 'vitalmesh-backend-source-v105.tar.gz';
const ENTRY = SERVER_DIR + '/backend/gateway/src/server.js';
const DATA_DIR = '/home/ubuntu/vitalmesh-data';
const LEGACY_DIR = '/home/ubuntu/vitalmesh-runtime';
const SERVER_SESSION = 'vitalmesh_server';
let _sid = null;
let _serverSid = null;
let _installPromise = null;
let _startPromise = null;

async function ensureSession() {
  if (_sid) return _sid;
  try {
    const s = await Tools.System.terminal.create('vitalmesh');
    _sid = (s && (s.sessionId || s.sessionName || s.id)) || 'vitalmesh';
  } catch (e) { _sid = 'vitalmesh'; }
  return _sid;
}
async function sh(command, timeoutMs) {
  const sid = await ensureSession();
  return await Tools.System.terminal.exec(sid, command, timeoutMs || 15000);
}
function bodyOf(r) {
  if (r === null || r === undefined) return '';
  if (typeof r === 'string') return r;
  return r.output !== undefined ? r.output : (r.body !== undefined ? r.body : r);
// 啟動與停止均透過專用的前台終端會話，不在此處輪詢端口。
}
async function install_dependencies() {
  if (_installPromise) return await _installPromise;
  _installPromise = (async function () {
    const check = await sh('[ -s ' + ENTRY + ' ] && [ -s ' + SERVER_DIR + '/backend/gateway/package.json ] && [ -x "$(command -v node)" ] && [ -x "$(command -v npm)" ] && echo READY || echo MISSING', 8000);
    if (String(bodyOf(check)).indexOf('READY') < 0) {
      let sourcePath = '';
      try { sourcePath = await ToolPkg.readResource(RES_SOURCE, SOURCE_ARCHIVE, false); } catch (e) {}
      if (!sourcePath) return { success: false, message: '無法讀取後端原始碼資源，請重裝插件' };
      await sh('mkdir -p ' + SERVER_DIR + ' && cp ' + sourcePath + ' ' + SERVER_DIR + '/' + SOURCE_ARCHIVE + ' && tar xzf ' + SERVER_DIR + '/' + SOURCE_ARCHIVE + ' -C ' + SERVER_DIR, 60000);
    }
    const result = await sh('cd ' + SERVER_DIR + '/backend/gateway && node --version && npm install --omit=dev --no-audit --no-fund', 180000);
    const output = String(bodyOf(result));
    if (result && result.exitCode !== undefined && result.exitCode !== 0) return { success: false, message: '依賴安裝失敗', log: output.slice(-4000) };
    if (output.indexOf('ERR!') >= 0 || output.indexOf('npm error') >= 0) return { success: false, message: '依賴安裝失敗', log: output.slice(-4000) };
    return { success: true, message: '依賴已就緒' };
  })();
  try { return await _installPromise; } finally { _installPromise = null; }
}
async function uninstall(params) {
  const deleteUserData = !!(params && params.delete_user_data === true);
  if (_serverSid && Tools.System.terminal.close) {
    try { await Tools.System.terminal.close(_serverSid); } catch (e) {}
    _serverSid = null;
  }
  await sh('if [ -d ' + SERVER_DIR + '/backend/gateway/data ]; then mkdir -p ' + DATA_DIR + '/legacy && cp -a ' + SERVER_DIR + '/backend/gateway/data/. ' + DATA_DIR + '/legacy/; fi', 30000);
  await sh('rm -rf ' + SERVER_DIR + ' ' + LEGACY_DIR, 30000);
  if (deleteUserData) await sh('rm -rf ' + DATA_DIR, 30000);
  _startPromise = null;
  _installPromise = null;
  return { success: true, message: deleteUserData ? 'VitalMesh 已卸載，服務會話、原始碼、依賴與使用者資料已刪除' : 'VitalMesh 已卸載，服務會話、原始碼與依賴已刪除，使用者資料已保留', data_retained: !deleteUserData };
}
async function getServerSession() {
  if (_serverSid) return _serverSid;
  const session = await Tools.System.terminal.create(SERVER_SESSION);
  _serverSid = session && session.sessionId;
  if (!_serverSid) throw new Error('無法建立 VitalMesh 專用終端會話');
  return _serverSid;
}
async function start_server() {
  if (_startPromise) return await _startPromise;
  _startPromise = (async function () {
    if (_serverSid) return { success: true, message: 'VitalMesh 啟動命令已提交，請勿重複點擊', url: BASE + '/' };
    const install = await install_dependencies();
    if (!install.success) return install;
    const sid = await getServerSession();
    const command = 'mkdir -p ' + DATA_DIR + ' ' + SERVER_DIR + '/backend/gateway/data; cd ' + SERVER_DIR + '/backend/gateway; HA_COMPAT_HOST=0.0.0.0 HA_COMPAT_PORT=' + PORT + ' VITALMESH_HA_DATA_DIR=' + DATA_DIR + ' VITALMESH_HA_TOKEN= node ' + ENTRY;
    await Tools.System.terminal.input(sid, { input: command, control: 'enter' });
    return { success: true, message: 'VitalMesh 已在專用終端以前台方式啟動', url: BASE + '/' };
  })();
  try { return await _startPromise; } finally { _startPromise = null; }
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
  uninstall: function (params) { return uninstall(params); },
  install_dependencies: function (params) { return install_dependencies(params); },
  start_server: function (params) { return start_server(params); },
  list_devices: function (params) { return listDevices(params); },
  list_sensors: function (params) { return listSensors(params); },
  get_sensor_latest: function (params) { return getSensorLatest(params); },
  get_sensor_history: function (params) { return getSensorHistory(params); },
};