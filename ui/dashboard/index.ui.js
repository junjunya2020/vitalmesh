/**
 * VitalMesh dashboard（側邊欄首頁）— 純 WebView + 包內自動啟動後端
 *
 * 對齊音樂播放器成功案例（music_player_ui/ui/player_page）：
 *   - ctx.createWebViewController(key) 建立控制器
 *   - ctx.UI.WebView({ key, controller, url }) 載入本機後端
 *   - 只有使用者按下「啟動服務」才會呼叫 start_server
 *     （對齊 netease_listen 的 ensureServerAsync 模式）
 */

const SERVER_URL = 'http://127.0.0.1:8123/';
const PACKAGE_NAME = 'vitalmesh_ha';
const TOOL_START_SERVER = 'start_server';

/** 只有使用者明確點擊按鈕時才啟動後端。 */
function startServerManually(ctx, setStatus) {
  const candidates = [PACKAGE_NAME + ':' + TOOL_START_SERVER, TOOL_START_SERVER];
  (async function () {
    setStatus('正在啟動服務...');
    for (let i = 0; i < candidates.length; i++) {
      try {
        const result = await ctx.callTool(candidates[i], {});
        setStatus(result && result.message ? result.message : '服務已啟動');
        return;
      } catch (e) {
        if (i === candidates.length - 1) setStatus('啟動失敗：' + (e && e.message ? e.message : String(e)));
      }
    }
  })();
}

function Screen(ctx) {
  const controller = ctx.createWebViewController('vitalmesh_webview');
  const [status, setStatus] = ctx.useState('status', '服務尚未啟動，請手動點擊啟動');

  return ctx.UI.Box(
    { fillMaxSize: true },
    [
      ctx.UI.Row(
        { height: 52, padding: { horizontal: 12, vertical: 6 }, verticalAlignment: 'center' },
        [
          ctx.UI.Text({ text: status, style: 'bodySmall', modifier: { weight: 1 } }),
          ctx.UI.Button(
            { height: 40, onClick: function () { startServerManually(ctx, setStatus); } },
            ctx.UI.Text({ text: '啟動服務', style: 'labelLarge' })
          )
        ]
      ),
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