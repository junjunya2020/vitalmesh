# 发布说明

## 当前版本

- ToolPkg ID：`com.vitalmesh.health_bridge`
- 版本：`0.1.0`
- 分支：`main`
- Git commit：`267c920`
- 作者：`junjunya2020`
- QQ：`11130431230`
- GitHub：[@junjunya2020](https://github.com/junjunya2020)

## 发布文件

正式发布文件位于：

```text
release/com.vitalmesh.health_bridge.toolpkg
release/SHA256SUMS
```

ToolPkg 内部只有一个后端运行时资源：

```text
resources/vitalmesh-runtime.tar.gz
```

## OperitAI 收录检查

发布前需要确认仓库侧支持以下内容：

1. `.toolpkg` 是否允许作为 `package` 类型提交。
2. 约 50MB 的 ToolPkg 是否超过单文件限制。
3. 是否要求源码提交到仓库、二进制包放到 Release 附件。
4. 是否需要市场索引元数据、分类字段或审核申请。
5. 发布地址是否必须是公开 GitHub 仓库，还是需要提交到 OperitAI 官方扩展仓库。

当前本地安装已经通过，但尚未推送远端，因为还没有确认目标仓库地址和写入授权，不能猜测仓库并上传。

## 建议发布结构

仓库根目录保留源码和 README，`release/` 保存最终 ToolPkg 与 SHA256 校验文件。若仓库不接受 50MB 二进制，则将 `.toolpkg` 放到 GitHub Release，由市场索引引用 Release 下载地址和 SHA256。

## 发布前验证

```bash
python3 -m json.tool manifest.json
unzip -t release/com.vitalmesh.health_bridge.toolpkg
sha256sum -c release/SHA256SUMS
```

## 特别鸣谢

特别感谢 OperitAI 提供 ToolPkg、终端与侧边栏 WebView 运行支持，也感谢 Home Assistant iOS 版本提供移动端健康数据采集与同步支持。

不要把 Token、secret.json、数据库、日志或设备数据提交到公开仓库。VPS 部署使用 Token 的方式与本机 ToolPkg 默认无 Token 的方式保持分离。