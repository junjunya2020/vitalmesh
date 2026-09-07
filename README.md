# VitalMesh Health Bridge

在 OperitAI 側邊欄中連線 VitalMesh 後端，讀取 iPhone / Apple Watch 的心率與健康數據。

## 架構說明與前置需求 (重要)

本插件為輕量原始碼包（體積約 25KB），**不再內置 Node.js 運行時或預編譯二進制庫**：

1. **環境前置條件**：
   - 本機環境（如 proot Ubuntu）需具備 `node` (版本 >= 20) 與 `npm`。
   - 首次啟動需連線網路安裝依賴。若處於無代理或海外連線較慢的網路環境，容易發生超時，建議先配置 npm 國內鏡像（例如 `npm config set registry https://registry.npmmirror.com`）或配置代理。

2. **高危行為與權限宣告**：
   - **終端會話**：啟動時將在專用前台終端會話 (`vitalmesh_server`) 運行服務。
   - **聯網裝包**：首次啟動或調用 `install_dependencies` 時，會執行 `npm install --omit=dev --no-audit --no-fund` 下載純 JS 依賴 (`ws`)。
   - **本機 HTTP 服務**：後端服務將在手機本機監聽 `0.0.0.0:8123` 端口。
   - **檔案讀寫**：
     - 後端原始碼將部署至 `/home/ubuntu/vitalmesh-source`。
     - 用戶健康歷史數據保存於 `/home/ubuntu/vitalmesh-data`。

3. **完全手動啟動**：
   - 本版本已徹底取消側邊欄或加載時的自動拉起，僅在側邊欄手動點擊「啟動服務」或手動調用 `start_server` 時啟動單一實例。

4. **安全卸載**：
   - 提供 `uninstall` 工具，停止本機服務並清理原始碼目錄；默認保留用戶健康歷史數據（僅在傳入 `delete_user_data: true` 時才清除）。

## 工具列表

- `start_server`: 啟動 VitalMesh 後端服務（0.0.0.0:8123）
- `install_dependencies`: 手動安裝後端依賴
- `uninstall`: 停止後端服務並安全卸載
- `list_devices`: 查看已接入的健康數據設備
- `list_sensors`: 查看指定設備的感測器列表
- `get_sensor_latest`: 獲取指定感測器最新數值
- `get_sensor_history`: 分頁獲取歷史數據
