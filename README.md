# VitalMesh Health Bridge

OperitAI ToolPkg 插件，在手机本机运行 VitalMesh Home Assistant 兼容网关，并通过侧边栏 WebView 展示健康数据。

首次使用请先阅读：[快速开始](./快速開始.md)

## 功能

- 侧边栏 WebView：打开本机 `http://127.0.0.1:8123/`
- 只有手動點選「啟動服務」後，才會部署原始碼並安裝生產依賴
- 後端綁定 `0.0.0.0:8123`
- 使用 OperitAI 執行環境提供的 `node` 與 `npm`
- 預設不設定 Token，適用於本機 ToolPkg
- 保留 VPS 部署版本使用的 MCP `/mcp` 接口
- 健康工具共 4 个：
  - `list_devices`
  - `list_sensors`
  - `get_sensor_latest`
  - `get_sensor_history`

## 工具调用协议

ToolPkg 内的健康工具优先调用本机 REST API：

- `GET /api/vitalmesh/dashboard`
- `GET /api/vitalmesh/sensors/{sensor_id}/history`

当 REST API 不可用时，自动回退到原有 MCP JSON-RPC `/mcp` 接口。VPS 部署版仍可直接使用原生 MCP。

## 執行架構

ToolPkg 只包含精簡的後端原始碼資源：

```text
resources/vitalmesh-backend-source.tar.gz
```

資源內只包含 `backend/**/*.js` 與 `backend/gateway/package.json`，不包含 Node.js、`node_modules`、native binary、編譯殘留或資料庫。首次執行 `start_server` 時，會在獨立目錄解壓原始碼並呼叫：

```bash
npm install --omit=dev --no-audit --no-fund
```

依賴安裝也可透過 `install_dependencies` 工具單獨執行。

## 安装

将发布目录中的：

```text
com.vitalmesh.health_bridge.toolpkg
```

导入 OperitAI ToolPkg。安装后从侧边栏打开「VitalMesh 健康」，点击「运行服务器」启动后端。

首次启动会将唯一 runtime 压缩包解压到：

```text
/home/ubuntu/vitalmesh-runtime/
```

## 发布文件

- `release/com.vitalmesh.health_bridge.toolpkg`：最终发布包
- `release/SHA256SUMS`：发布包校验值
- `resources/vitalmesh-runtime.tar.gz`：ToolPkg 内置运行时资源

## 作者与联系方式

- QQ：`11130431230`
- GitHub：[@junjunya2020](https://github.com/junjunya2020)

## 特别鸣谢

特别感谢：

- OperitAI：提供 ToolPkg、终端与侧边栏 WebView 运行支持。
- Home Assistant iOS 版本：提供移动端健康数据采集与同步支持。

## 许可证

本项目采用 Apache License 2.0，详见根目录的 `LICENSE` 文件。

发布包内包含 Node.js、better-sqlite3、ws 等第三方运行组件；这些组件的原始许可证和版权声明应按照各自许可证要求保留。
