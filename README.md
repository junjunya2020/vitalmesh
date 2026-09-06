# VitalMesh Health Bridge

OperitAI ToolPkg 插件，在手机本机运行 VitalMesh Home Assistant 兼容网关，并通过侧边栏 WebView 展示健康数据。

## 功能

- 侧边栏 WebView：打开本机 `http://127.0.0.1:8123/`
- 点击启动服务器后，包内自动部署并启动完整运行时
- 后端绑定 `0.0.0.0:8123`
- 内置完整 ARM64 Node.js v20.19.4
- 内置 `node_modules` 与 ARM64 `better_sqlite3.node`
- 默认不设置 Token，适用于本机 ToolPkg
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

## 运行时结构

ToolPkg 只包含一个后端资源：

```text
resources/vitalmesh-runtime.tar.gz
```

该压缩包内包含：

```text
node/                       完整 Node.js ARM64 v20.19.4
backend/entry.cjs          后端入口
backend/bundle.cjs         打包后的后端代码
backend/node_modules/      运行依赖
backend/build/Release/     ARM64 better_sqlite3.node
```

无需另外安装 Node.js、npm 或 npm 依赖。

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

当前项目沿用 VitalMesh 项目许可证。发布到公共仓库前，请确保后端依赖及 Node.js 运行时的许可证文件一并保留。
