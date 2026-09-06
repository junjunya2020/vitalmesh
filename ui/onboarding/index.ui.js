/**
 * VitalMesh 初始化嚮導（onboarding）
 *
 * 步驟：
 *   1. 顯示目前區域網路 IP（自動偵測）+ 產生 API Token
 *   2. 用戶記下 token
 *   3. 引導：HA App 輸入 http://<IP>:8123 + token + 開啟健康權限
 *   4. 完成後點「完成初始化」→ 寫 secret → 跳轉 dashboard
 */
function Screen(ctx) {
  const { UI } = ctx;
  const colors = ctx.MaterialTheme.colorScheme;

  const [state, setState] = ctx.useState("state", null);          // {initialized, token, backendUrl, lanIp}
  const [step, setStep] = ctx.useState("step", 0);                 // 0 初始化中, 1 顯示 IP/token, 2 完成
  const [loading, setLoading] = ctx.useState("loading", true);
  const [errorText, setErrorText] = ctx.useState("errorText", "");
  const [confirmed, setConfirmed] = ctx.useState("confirmed", false); // 用戶勾選「已記下 token」
  const [backendUrl, setBackendUrl] = ctx.useState("backendUrl", "");

  async function loadState() {
    try {
      const s = await ToolPkg.ipc.call("vitalmesh.getState", {});
      setState(s);
      if (s.initialized) {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (e) {
      setErrorText("無法讀取狀態: " + (e && e.message ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function onLoad() {
    loadState();
  }

  function startOnboarding() {
    // 產生 token 並寫入 secret
    setLoading(true);
    setErrorText("");
    ToolPkg.ipc.call("vitalmesh.doOnboarding", { backendUrl: backendUrl })
      .then(function (s) {
        setState(s);
        setStep(2);
      })
      .catch(function (e) {
        setErrorText("初始化失敗: " + (e && e.message ? e.message : String(e)));
      })
      .finally(function () {
        setLoading(false);
      });
  }

  const lanIp = (state && state.lanIp) || "偵測中...";
  const token = (state && state.token) || "";

  return UI.Box(
    { fillMaxSize: true },
    UI.LazyColumn(
      {
        fillMaxSize: true,
        padding: { horizontal: 20, vertical: 24 },
        spacing: 16,
        background: colors.surface,
      },
      [
        UI.Row({ verticalAlignment: "center" }, [
          UI.Surface(
            {
              width: 46,
              height: 46,
              shape: { cornerRadius: 10 },
              containerColor: colors.primaryContainer,
              contentColor: colors.onPrimaryContainer,
            },
            UI.Box(
              { fillMaxSize: true, contentAlignment: "center" },
              UI.Icon({ name: "Favorite", size: 24, tint: colors.primary })
            )
          ),
          UI.Spacer({ width: 12 }),
          UI.Column({ weight: 1, spacing: 2 }, [
            UI.Text({
              text: "VitalMesh 健康橋接",
              style: "titleLarge",
              fontWeight: "bold",
              color: colors.onSurface,
            }),
            UI.Text({
              text: "第一次使用需要初始化",
              style: "bodyMedium",
              color: colors.onSurfaceVariant,
            }),
          ]),
        ]),

        // ===== 步驟 1：顯示 IP 與 Token 引導 =====
        step === 1
          ? UI.Column({ spacing: 14 }, [
              UI.Surface(
                {
                  fillMaxWidth: true,
                  shape: { cornerRadius: 8 },
                  containerColor: colors.primaryContainer,
                  contentColor: colors.onPrimaryContainer,
                },
                UI.Column({ padding: 16, spacing: 10 }, [
                  UI.Row({ verticalAlignment: "center" }, [
                    UI.Icon({ name: "Wifi", size: 20, tint: colors.primary }),
                    UI.Spacer({ width: 8 }),
                    UI.Text({
                      text: "步驟 1：設定後端位址",
                      style: "titleMedium",
                      fontWeight: "semiBold",
                      color: colors.onSurface,
                    }),
                  ]),
                  UI.HorizontalDivider({ color: colors.outlineVariant.copy({ alpha: 0.4 }), thickness: 1 }),
                  UI.Text({
                    text: "目前區域網路 IP：",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                  }),
                  UI.Surface(
                    {
                      fillMaxWidth: true,
                      shape: { cornerRadius: 6 },
                      containerColor: colors.surface,
                    },
                    UI.Text({
                      text: lanIp,
                      padding: { horizontal: 12, vertical: 8 },
                      style: "titleMedium",
                      fontFamily: "monospace",
                      fontWeight: "semiBold",
                      color: colors.primary,
                    })
                  ),
                  UI.Text({
                    text: "在 iPhone 的 Home Assistant App 中輸入此位址：",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                  }),
                  UI.Surface(
                    {
                      fillMaxWidth: true,
                      shape: { cornerRadius: 6 },
                      containerColor: colors.tertiaryContainer,
                    },
                    UI.Text({
                      text: "http://" + lanIp + ":8123",
                      padding: { horizontal: 12, vertical: 8 },
                      style: "titleSmall",
                      fontFamily: "monospace",
                      color: colors.onTertiaryContainer,
                    })
                  ),
                ])
              ),

              UI.Surface(
                {
                  fillMaxWidth: true,
                  shape: { cornerRadius: 8 },
                  containerColor: colors.secondaryContainer,
                  contentColor: colors.onSecondaryContainer,
                },
                UI.Column({ padding: 16, spacing: 10 }, [
                  UI.Row({ verticalAlignment: "center" }, [
                    UI.Icon({ name: "Lock", size: 20, tint: colors.primary }),
                    UI.Spacer({ width: 8 }),
                    UI.Text({
                      text: "步驟 2：API Token",
                      style: "titleMedium",
                      fontWeight: "semiBold",
                      color: colors.onSurface,
                    }),
                  ]),
                  UI.HorizontalDivider({ color: colors.outlineVariant.copy({ alpha: 0.4 }), thickness: 1 }),
                  UI.Text({
                    text: "系統已產生 API Token，請手動複製並妥善保存：",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                  }),
                  UI.Surface(
                    {
                      fillMaxWidth: true,
                      shape: { cornerRadius: 6 },
                      containerColor: colors.surface,
                    },
                    UI.Text({
                      text: token || "（點下方按鈕產生）",
                      padding: { horizontal: 12, vertical: 10 },
                      style: "titleSmall",
                      fontFamily: "monospace",
                      color: colors.primary,
                      selectable: true,
                    })
                  ),
                  UI.Text({
                    text: "將此 Token 填到 Home Assistant App 的登入/連線設定中。",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                  }),
                ])
              ),

              UI.Surface(
                {
                  fillMaxWidth: true,
                  shape: { cornerRadius: 8 },
                  containerColor: colors.surfaceVariant,
                },
                UI.Column({ padding: 16, spacing: 10 }, [
                  UI.Row({ verticalAlignment: "center" }, [
                    UI.Icon({ name: "Favorite", size: 20, tint: colors.primary }),
                    UI.Spacer({ width: 8 }),
                    UI.Text({
                      text: "步驟 3：開啟健康權限",
                      style: "titleMedium",
                      fontWeight: "semiBold",
                      color: colors.onSurface,
                    }),
                  ]),
                  UI.HorizontalDivider({ color: colors.outlineVariant.copy({ alpha: 0.4 }), thickness: 1 }),
                  UI.Text({
                    text: "在 iPhone 的健康 App 中允許 Home Assistant 讀取健康資料（Heart Rate、步數、活動能量等）。",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                  }),
                ])
              ),

              UI.Surface(
                {
                  fillMaxWidth: true,
                  shape: { cornerRadius: 8 },
                  containerColor: colors.surface,
                },
                UI.Row({ verticalAlignment: "center", padding: { horizontal: 8, vertical: 4 } }, [
                  UI.Checkbox({ checked: confirmed, onCheckedChange: function (v) { setConfirmed(v); } }),
                  UI.Spacer({ width: 8 }),
                  UI.Text({
                    text: "我已記下 Token（待填到 HA）",
                    style: "bodyMedium",
                    color: colors.onSurface,
                  }),
                ])
              ),

              UI.Button(
                {
                  fillMaxWidth: true,
                  height: 50,
                  shape: { cornerRadius: 8 },
                  enabled: confirmed && !loading,
                  onClick: startOnboarding,
                },
                UI.Row(
                  { fillMaxWidth: true, horizontalArrangement: "center", verticalAlignment: "center" },
                  [
                    UI.Icon({ name: "Check", size: 18, tint: colors.onPrimary }),
                    UI.Spacer({ width: 8 }),
                    UI.Text({
                      text: "完成初始化",
                      style: "labelLarge",
                      color: colors.onPrimary,
                    }),
                  ]
                )
              ),
            ])
          : step === 2
            ? UI.Column({ spacing: 14 }, [
                UI.Surface(
                  {
                    fillMaxWidth: true,
                    shape: { cornerRadius: 8 },
                    containerColor: colors.primaryContainer,
                    contentColor: colors.onPrimaryContainer,
                  },
                  UI.Column({ padding: 16, spacing: 10 }, [
                    UI.Row({ verticalAlignment: "center" }, [
                      UI.Icon({ name: "CheckCircle", size: 22, tint: colors.primary }),
                      UI.Spacer({ width: 8 }),
                      UI.Text({
                        text: "初始化完成！",
                        style: "titleMedium",
                        fontWeight: "semiBold",
                        color: colors.onSurface,
                      }),
                    ]),
                    UI.Text({
                      text: "後端位址：" + ((state && state.backendUrl) || "") + "\nToken：已保存至本機密碼文件",
                      style: "bodySmall",
                      color: colors.onSurfaceVariant,
                    }),
                  ])
                ),
                UI.Button(
                  {
                    fillMaxWidth: true,
                    height: 50,
                    shape: { cornerRadius: 8 },
                    onClick: function () {
                      ctx.navigate(ROUTE_DASHBOARD_GLOBAL);
                    },
                  },
                  UI.Text({
                    text: "前往 VitalMesh 面板",
                    style: "labelLarge",
                    color: colors.onPrimary,
                  })
                ),
              ])
            : UI.CircularProgressIndicator({ color: colors.primary }),

        errorText
          ? UI.Text({
              text: errorText,
              style: "bodySmall",
              color: colors.error,
              maxLines: 6,
            })
          : null,
      ]
    )
  );
}

exports.default = Screen;