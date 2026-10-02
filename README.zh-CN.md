# dsh-theme-ink

DeepSeek Harness Web UI 的水墨主题插件：不透明宣纸面板、浮于内容之上的
朱红印章与枯笔飞白、四缘晕染的墨滴与飘落竹叶。字体沿用 dsh 默认字体。

主题加载即启用（无开关）——禁用或卸载插件即可还原默认主题。

![hero](docs/screenshots/ink.png)

## 安装

安装进 web profile（依赖 `webServer` 服务，请勿装进 headless profile）：

```sh
dsh plugin --profile web add github:jiangwangyang/dsh-theme-ink
```

刷新 Web UI 即可生效；在插件管理中禁用/卸载即还原。

## 实现说明

- **Host 半边**（`src/index.js`）：经 `webServer` 服务 `/ink/ink.css` 与
  `/ink/ink.js`（按请求读盘，改动后刷新即生效），并通过 `tapIndex` 向
  `index.html` 注入激活标记、样式表与 defer 渲染器脚本，避免首屏闪默认主题。
- **客户端半边**（`src/client/index.js`）：经 `ctx.theme.overrideTokens`
  把水墨调色板叠在当前主题之上（与 light/dark/system 偏好通道正交，不注册
  主题 id、不读写偏好），每次 `theme/change` 后断言浅色渲染基调，并挂载
  结构层与 `window.DshInk` 渲染器；卸载时全部还原。
- **结构层**（`assets/ink.css`）：由 `html[data-dsh-ink]` 门控——shiki 墨色
  高亮令牌与顶层特效层（`z-index: 9998`、`pointer-events: none`）承载朱红
  印章、枯笔飞白与粒子画布，浮于全部内容之上。面板为令牌覆盖层提供的
  不透明宣纸实色，无底层背景层。
- **渲染器**（`assets/ink.js`）：创建特效层、印章与画布；轻量 2D canvas
  粒子循环（30fps 限速）——四缘晕染墨滴与飘落竹叶，移植自 openagents
  水墨主题；`prefers-reduced-motion` 下降级为静态单帧。

## License

MIT
