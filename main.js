/**
 * VitalMesh Health Bridge - ToolPkg 主入口（極簡版）
 *
 * 完全對齊成功案例 music_player_ui 的結構：
 *   1. 側邊欄頁面（main_sidebar_plugins）→ 純 WebView 開啟本機 8123
 *   2. 不做任何後端部署 / IPC 呼叫 / 狀態檢查
 *
 * 注意：欄位嚴格對齊成功案例，不加多余的 params / keepAlive / icon。
 */
function registerToolPkg() {
  // 側邊欄頁面（純 WebView → http://127.0.0.1:8123/）
  ToolPkg.registerUiRoute({
    id: 'dashboard',
    route: 'toolpkg:com.vitalmesh.health_bridge:ui:dashboard',
    runtime: 'compose_dsl',
    screen: 'ui/dashboard/index.ui.js',
    title: {
      zh: 'VitalMesh 健康橋接',
      en: 'VitalMesh Health Bridge'
    }
  });

  // 側邊欄入口
  ToolPkg.registerNavigationEntry({
    id: 'vitalmesh_dashboard_sidebar',
    route: 'toolpkg:com.vitalmesh.health_bridge:ui:dashboard',
    surface: 'main_sidebar_plugins',
    title: {
      zh: 'VitalMesh 健康',
      en: 'VitalMesh Health'
    },
    order: 132
  });

  return true;
}

exports.registerToolPkg = registerToolPkg;