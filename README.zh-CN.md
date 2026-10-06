# dsh-theme-ink

DeepSeek Harness Web UI 的水墨主题插件：不透明宣纸面板、浮于内容之上的
朱红印章与枯笔飞白、四缘晕染的墨滴与飘落竹叶。字体沿用 dsh 默认字体。

主题加载即启用（无开关）——禁用或卸载插件即可还原默认主题。

![hero](docs/screenshots/ink.png)

## 安装

安装进 web profile（纯浏览器侧呈现，无 Host 侧服务依赖）：

```sh
dsh plugin --profile web add github:jiangwangyang/dsh-theme-ink
```

刷新 Web UI 即可生效；在插件管理中禁用/卸载即还原。

## 实现说明

主题为纯浏览器侧呈现：Host 半边（`src/index.js`）是空实现，仅承担启停
日志；全部逻辑位于单个免构建 client bundle（`src/client/index.js`）中：

- **令牌覆盖层**：经 `ctx.theme.overrideTokens` 把水墨调色板叠在当前
  主题之上（与 light/dark/system 偏好通道正交，不注册主题 id、不读写
  偏好），每次 `theme/change` 后断言浅色渲染基调；卸载时全部还原。
- **结构层**（内联样式表 `STRUCTURE_CSS`，原 `assets/ink.css`）：由
  `html[data-dsh-ink]` 门控——shiki 墨色高亮令牌与顶层特效层
  （`z-index: 9998`、`pointer-events: none`）承载朱红印章、枯笔飞白与
  粒子画布，浮于全部内容之上。面板为令牌覆盖层提供的不透明宣纸实色，
  无底层背景层。
- **渲染器**（`createInkRenderer()`，内联，原 `assets/ink.js`）：创建
  特效层、印章与画布；轻量 2D canvas 粒子循环（30fps 限速）——四缘
  晕染墨滴与飘落竹叶，移植自 openagents 水墨主题；
  `prefers-reduced-motion` 下降级为静态单帧。

样式表与渲染器全部内联于 client bundle，随客户端插件加载到达——无静态
资源路由、无 index.html 注入、无 `window` 全局控制器；代价是 bundle
加载前可能短暂闪现默认主题。

## License

MIT
