/**
 * VitalMesh dashboard（側邊欄首頁）— 純 WebView + 包內自動啟動後端
 *
 * 對齊音樂播放器成功案例（music_player_ui/ui/player_page）：
 *   - ctx.createWebViewController(key) 建立控制器
 *   - ctx.UI.WebView({ key, controller, url }) 載入本機後端
 *   - onLoad 觸發 ctx.callTool('vitalmesh_ha:start_server') 包內自動啟動後端
 *     （對齊 netease_listen 的 ensureServerAsync 模式）
 */

const SERVER_URL = 'http://127.0.0.1:8123/';
const PACKAGE_NAME = 'vitalmesh_ha';
const TOOL_START_SERVER = 'start_server';

/** 觸發包內啟動後端（fire-and-forget，不阻塞 UI 渲染） */
function ensureServerAsync(ctx) {
  const candidates = [PACKAGE_NAME + ':' + TOOL_START_SERVER, TOOL_START_SERVER];
  (async function () {
    for (let i = 0; i < candidates.length; i++) {
      try {
        await ctx.callTool(candidates[i], {});
        return;
      } catch (e) { /* 下一個候選 */ }
    }
  })();
}

function Screen(ctx) {
  const controller = ctx.createWebViewController('vitalmesh_webview');
  const [initialized, setInitialized] = ctx.useState('initialized', false);

  /** 進入頁面：確認已初始化 + 觸發後端啟動 */
  async function boot() {
    if (initialized) return;
    setInitialized(true);
    ensureServerAsync(ctx);
  }

  return ctx.UI.Box(
    {
      fillMaxSize: true,
      onLoad: boot
    },
    [
      ctx.UI.WebView({
        key: 'vitalmesh_webview_main',
        fillMaxSize: true,
        controller: controller,
        url: SERVER_URL,
        nestedScrollInterop: true,
        javaScriptEnabled: true,
        domStorageEnabled: true,
        supportZoom: false,
        useWideViewPort: true,
        loadWithOverviewMode: true
      }),
      ctx.UI.Spacer({ height: 0 })
    ]
  );
}

exports.default = Screen;