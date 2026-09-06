/**
 * VitalMesh Health Bridge - 共用邏輯（main 上下文）
 *
 * 提供：
 *   - 狀態持久化（secret.json：token / backendUrl / initialized）
 *   - 產生命名 token
 *   - 取得本機區域網路 IP
 *
 * 所有函式都是純 async，UI 與子包透過 ToolPkg.ipc 呼叫。
 * （本機版不自動安裝 MCP：工具直接在包內對後端 /mcp 發 JSON-RPC；
 *   MCP 保留給 VPS 部署版本使用）
 */

/** 固定路徑 */
var SECRET_FILE = '/sdcard/Download/Operit/vitalmesh/secret.json';

/** 產生 64 hex 隨機 token */
function generateToken() {
  var bytes = [];
  for (var i = 0; i < 32; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  var hex = '';
  for (var j = 0; j < bytes.length; j++) {
    var b = bytes[j].toString(16);
    if (b.length < 2) b = '0' + b;
    hex += b;
  }
  return hex;
}

/** 讀取 secret 檔案（不存在回傳 null） */
async function readSecret() {
  try {
    var exists = await Tools.Files.exists(SECRET_FILE);
    if (!exists.exists) return null;
    var content = await Tools.Files.read(SECRET_FILE);
    if (!content || !content.content) return null;
    return JSON.parse(content.content);
  } catch (e) {
    return null;
  }
}

/** 寫入 secret 檔案 */
async function writeSecret(data) {
  await Tools.Files.mkdir('/sdcard/Download/Operit/vitalmesh', true);
  await Tools.Files.write(SECRET_FILE, JSON.stringify(data, null, 2));
  return true;
}

/** 取得本機區域網路 IPv4（跑 shell ip addr） */
async function getLanIp() {
  try {
    var res = await Tools.System.shell('ip -4 addr show 2>/dev/null || ip addr show 2>/dev/null');
    var output = (res && res.output) ? res.output : '';
    var match = output.match(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
    if (!match) return '';
    for (var i = 0; i < match.length; i++) {
      var ip = match[i].replace('inet ', '');
      if (ip === '127.0.0.1') continue;
      if (ip.indexOf('127.') === 0) continue;
      return ip;
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * 取得完整狀態（供 UI 判斷初始化與否）
 * 注意：tool 包版本『預設不設定 token』（後端無鑑權，本機使用），
 * token 留給 VPS 部署版（獨立方法）。
 */
async function getState() {
  var secret = await readSecret();
  var lanIp = await getLanIp();
  var initialized = !!(secret && secret.backendUrl);
  return {
    initialized: initialized,
    hasToken: !!(secret && secret.token),
    token: (secret && secret.token) || '',
    backendUrl: (secret && secret.backendUrl) || '',
    lanIp: lanIp,
    secretFile: SECRET_FILE
  };
}

/**
 * 執行初始化：寫入 backendUrl、不設定 token（tool 包預設無鑑權），回傳狀態
 * （VPS 部署版的 token 設定是獨立方法，不在此處理）
 */
async function doOnboarding(backendUrl) {
  var baseUrl = backendUrl || ('http://' + (await getLanIp()) + ':8123');
  var secret = {
    token: '',
    backendUrl: baseUrl,
    initialized: true,
    createdAt: Date.now()
  };
  await writeSecret(secret);
  return await getState();
}

/**
 * 重新初始化（tool 包版：清空 token、重設 backendUrl）
 */
async function resetToken() {
  var secret = (await readSecret()) || {};
  secret.token = '';
  secret.initialized = true;
  await writeSecret(secret);
  return await getState();
}

module.exports = {
  generateToken: generateToken,
  readSecret: readSecret,
  writeSecret: writeSecret,
  getLanIp: getLanIp,
  getState: getState,
  doOnboarding: doOnboarding,
  resetToken: resetToken
};
