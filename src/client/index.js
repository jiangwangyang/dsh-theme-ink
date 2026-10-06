// ==========================================
// dsh-theme-ink — 客户端半边（免构建单文件 client bundle）
//
// dsh 客户端模块系统的既定契约：执行 bundle 仅注册工厂
//（window.__ModuleLoader__.load({ id, factory })），模块体副作用在工厂
// 物化时运行；factory 收到的 require 由模块表应答。本文件直接作为
// client bundle 提供（package.json exports["./client"]），无需构建步骤。
//
// 本插件无开关：加载即启用，卸载即还原。职责只有三件：
//   1. 令牌覆盖层：ctx.theme.overrideTokens 把宣纸水墨调色板叠在当前
//      主题之上。覆盖层与 light/dark/system 偏好通道正交——不注册主题
//      id、不读写主题偏好，卸载时覆盖层随纤维回收自动还原；
//   2. 浅色渲染基调断言：ui-layout 的 ThemePresenter 每次发布都按偏好
//      重写 color-scheme 与 body[data-ds-dark-theme] 暗色基底；水墨是
//      单套宣纸浅色，需要浅色基底兜底未覆盖的令牌，故在每次 theme/change
//      后（内置插件先注册监听，本监听器运行于 presenter 之后）把
//      color-scheme 重新断言为 light 并摘除暗色基底属性——只改呈现，
//      不碰偏好；
//   3. 结构层视觉：内联样式表（STRUCTURE_CSS，含 shiki 令牌与上层特效
//      层）+ 闭包化的水墨粒子渲染器（createInkRenderer）。样式与渲染器
//      均随 bundle 到达，无静态资源路由、无 index.html 注入、无 window
//      全局控制器；代价是客户端 bundle 加载前可能闪现默认主题。
// ==========================================
window.__ModuleLoader__.load({
  id: 'dsh-theme-ink',
  factory: () => {
    'use strict'
    /** 令牌覆盖层 source 标识（动态包门面会改钉为包 id，此处为直装插件路径）。 */
    const SOURCE = 'ink'

    /** 激活标记：html 属性门控 STRUCTURE_CSS 结构层；style 标签携带同名标记便于定位。 */
    const MARK = 'data-dsh-ink'

    /** ui-layout ThemePresenter 按偏好维护的暗色基底属性（呈现层，只读其契约）。 */
    const DARK_ATTRIBUTE = 'data-ds-dark-theme'

    /**
     * 宣纸水墨调色板：令牌名 → 单套色值。面板为不透明宣纸实色，纸色由
     * 面板自身承担（无底层背景）；装饰（印章/飞白/墨滴/竹叶）由渲染器
     * 的特效层画在内容之上。品牌强调色为朱红印章 #b03a2e，文字为松烟墨
     * #1c1a17 梯度，成功色取竹青 #3d6b4f。
     */
    const PALETTE = {
      /* 背景：不透明宣纸实色（无负层级背景层，纸色由面板自身承担） */
      '--dsw-alias-bg-base': 'rgb(242, 236, 223)',
      '--dsw-alias-bg-layer-1': 'rgb(250, 246, 236)',
      '--dsw-alias-bg-layer-2': 'rgb(250, 246, 236)',
      '--dsw-alias-bg-layer-3': 'rgb(250, 246, 236)',
      '--dsw-alias-bg-mask-1': 'rgba(28, 26, 23, 0.42)',
      '--dsw-alias-bg-mask-2': 'rgba(28, 26, 23, 0.20)',
      '--dsw-alias-bg-mask-3': 'rgba(28, 26, 23, 0.48)',
      '--dsw-alias-bg-mask-photo': 'rgba(28, 26, 23, 0.85)',
      '--dsw-alias-bg-mask-drop': 'rgb(236, 228, 210)',
      '--dsw-alias-bg-module-platform': 'rgb(236, 228, 210)',
      '--dsw-alias-bg-multi-select': 'rgb(250, 246, 236)',
      '--dsw-alias-bg-overlay': 'rgb(250, 246, 236)',
      '--dsw-alias-bg-skeleton': 'rgba(28, 26, 23, 0.06)',

      /* 描边：赭石纸纹线，随层级加深 */
      '--dsw-alias-border-inverted2': 'rgba(28, 26, 23, 0.12)',
      '--dsw-alias-border-inverted': 'rgba(28, 26, 23, 0.08)',
      '--dsw-alias-border-l1': 'rgba(92, 85, 74, 0.14)',
      '--dsw-alias-border-l2-darkmode-thin': 'rgba(92, 85, 74, 0.18)',
      '--dsw-alias-border-l2': 'rgb(221, 212, 192)',
      '--dsw-alias-border-l3': 'rgb(201, 191, 168)',
      '--dsw-alias-border-l4': 'rgb(179, 168, 148)',

      /* 品牌：朱红印章（前景文字取宣纸白，保证朱红底上的对比度） */
      '--dsw-alias-brand-primary-invert': 'rgb(250, 246, 236)',
      '--dsw-alias-brand-primary-new-colorprimary-new-color': 'rgb(192, 64, 50)',
      '--dsw-alias-brand-primary': 'rgb(176, 58, 46)',
      '--dsw-alias-brand-text': 'rgb(176, 58, 46)',

      /* 按钮 */
      '--dsw-alias-button-contrast-fill': 'rgb(28, 26, 23)',
      '--dsw-alias-button-elevated-fill': 'rgb(250, 246, 236)',
      '--dsw-alias-button-floating-fill': 'rgb(250, 246, 236)',
      '--dsw-alias-button-floating-hover': 'rgb(255, 251, 242)',
      '--dsw-alias-button-ghost-active-border': 'rgb(176, 58, 46)',
      '--dsw-alias-button-ghost-active-fill': 'rgba(176, 58, 46, 0.08)',
      '--dsw-alias-button-ghost-active-hover': 'rgba(176, 58, 46, 0.14)',
      '--dsw-alias-button-info-fill': 'rgb(176, 58, 46)',
      '--dsw-alias-button-info-hover': 'rgb(192, 64, 50)',
      '--dsw-alias-button-primary-dimmed': 'rgba(176, 58, 46, 0.14)',
      '--dsw-alias-button-primary-fill': 'rgb(176, 58, 46)',
      '--dsw-alias-button-primary-hover': 'rgb(192, 64, 50)',
      '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(250, 246, 236, 0.5)',
      '--dsw-alias-button-tool-bar-fill': 'rgb(250, 246, 236)',
      '--dsw-alias-button-tool-bar-hover': 'rgb(236, 228, 210)',

      /* 交互态：墨色叠层压暗，强调态染朱红 */
      '--dsw-alias-interactive-bg-active': 'rgba(28, 26, 23, 0.10)',
      '--dsw-alias-interactive-bg-hover-accent': 'rgba(176, 58, 46, 0.10)',
      '--dsw-alias-interactive-bg-hover-danger': 'rgba(160, 40, 24, 0.10)',
      '--dsw-alias-interactive-bg-hover-solid': 'rgba(28, 26, 23, 0.08)',
      '--dsw-alias-interactive-bg-hover': 'rgba(28, 26, 23, 0.05)',

      /* 文字：松烟墨梯度 */
      '--dsw-alias-label-caption': 'rgb(138, 128, 114)',
      '--dsw-alias-label-dimmed': 'rgb(179, 168, 148)',
      '--dsw-alias-label-primary-bluish': 'rgb(176, 58, 46)',
      '--dsw-alias-label-primary-dimmed': 'rgb(92, 85, 74)',
      '--dsw-alias-label-primary-foreground': 'rgb(250, 246, 236)',
      '--dsw-alias-label-primary-inverted': 'rgb(250, 246, 236)',
      '--dsw-alias-label-primary': 'rgb(28, 26, 23)',
      '--dsw-alias-label-secondary': 'rgb(58, 53, 46)',
      '--dsw-alias-label-tertiary': 'rgb(92, 85, 74)',

      /* Markdown：代码块为不透明熟宣色，选中段染朱红 */
      '--dsw-alias-markdown-citation': 'rgba(176, 58, 46, 0.08)',
      '--dsw-alias-markdown-code-block-banner': 'rgb(228, 219, 199)',
      '--dsw-alias-markdown-code-block': 'rgb(239, 231, 213)',
      '--dsw-alias-markdown-code-segment-selected': 'rgba(176, 58, 46, 0.16)',
      '--dsw-alias-markdown-code-segment-unselected': 'rgba(239, 231, 213, 0.7)',
      '--dsw-alias-markdown-inline-code': 'rgba(176, 58, 46, 0.08)',
      '--dsw-alias-markdown-placeholder': 'rgba(28, 26, 23, 0.05)',
      '--dsw-alias-markdown-tag': 'rgba(28, 26, 23, 0.06)',

      /* 滚动条 */
      '--dsw-alias-scrollbar-bg-l1': 'rgba(92, 85, 74, 0.24)',
      '--dsw-alias-scrollbar-bg-l2': 'rgba(92, 85, 74, 0.30)',
      '--dsw-alias-scrollbar-hover-l1': 'rgba(92, 85, 74, 0.42)',
      '--dsw-alias-scrollbar-hover-l2': 'rgba(92, 85, 74, 0.50)',

      /* 状态色：业务主色染朱红，成功取竹青，警告取赭黄，按纸底压深 */
      '--dsw-alias-state-business-primary': 'rgb(176, 58, 46)',
      '--dsw-alias-state-business-tertiary': 'rgba(176, 58, 46, 0.12)',
      '--dsw-alias-state-error-primary': 'rgb(160, 40, 24)',
      '--dsw-alias-state-error-secondary': 'rgb(176, 58, 46)',
      '--dsw-alias-state-success-primary': 'rgb(61, 107, 79)',
      '--dsw-alias-state-success-secondary': 'rgb(77, 127, 96)',
      '--dsw-alias-state-success-tertiary': 'rgba(61, 107, 79, 0.12)',
      '--dsw-alias-state-warn-label': 'rgb(154, 108, 26)',
      '--dsw-alias-state-warn-primary': 'rgb(176, 126, 32)',
      '--dsw-alias-state-warn-secondary': 'rgb(192, 140, 40)',
      '--dsw-alias-state-warn-tertiary': 'rgba(176, 126, 32, 0.12)',

      /* 浮层：浓墨底保证可读性（印章印泥式的深浅反转） */
      '--dsw-alias-toast-bg': 'rgba(28, 26, 23, 0.92)',
      '--dsw-alias-tooltip-bg': 'rgba(28, 26, 23, 0.94)',

      /* 专项表面（全部不透明实色） */
      '--dsw-specific-bubble-highlight': 'rgba(176, 58, 46, 0.10)',
      '--dsw-specific-bubble': 'rgb(250, 246, 236)',
      '--dsw-specific-input-major': 'rgb(250, 246, 236)',
      '--dsw-specific-login-input': 'rgb(250, 246, 236)',
      '--dsw-specific-menu': 'rgb(250, 246, 236)',
      '--dsw-specific-selector': 'rgb(250, 246, 236)',
      '--dsw-specific-sidebar-fill': 'rgb(236, 228, 210)',
      '--dsw-specific-sidebar-nav-item-active-accent': 'rgba(176, 58, 46, 0.12)',
      '--dsw-specific-sidebar-nav-item-active': 'rgba(28, 26, 23, 0.06)',
      '--dsw-specific-sidebar-nav-item-hover': 'rgba(28, 26, 23, 0.04)',
      '--dsw-specific-tip': 'rgb(250, 246, 236)',
    }

    /**
     * overrideTokens 契约要求每令牌给出 { light, dark } 双表（裸字符串会抛
     * 教学性错误）；水墨为单套宣纸色，两档填同一值，使浅色/深色/跟随系统
     * 任一档下覆盖层渲染一致。
     */
    const TOKENS = Object.fromEntries(
      Object.entries(PALETTE).map(([name, value]) => [name, { light: value, dark: value }]),
    )

    /** 结构层样式（原 assets/ink.css 内联；层叠模型详见其中注释）。 */
    const STRUCTURE_CSS = `/* ==========================================
   dsh 水墨主题 — 结构层样式
   宣纸水墨调色板（--dsw-* 令牌覆写）由客户端半边经
   ctx.theme.overrideTokens 进入令牌覆盖层，以 body 内联变量的形式
   生效并随卸载还原；本样式表只承载令牌契约之外的结构与呈现：
   shiki 墨色高亮与上层特效层（朱红印章 + 枯笔飞白 + 墨滴竹叶画布）。
   字体沿用 dsh 自身字体，主题不做覆写。
   全部规则由 html[data-dsh-ink] 门控，卸载摘除该属性即还原。

   层叠模型（不依赖任何官方内部节点，无负层级、无底层背景）：
     面板为不透明宣纸实色（--dsw-* 令牌），纸色由面板自身承担
       → #dsh-ink-fx（z-index:9998：印章/飞白 + 粒子画布，浮于内容
          之上，pointer-events:none 不拦截交互）
   ========================================== */

/* 浅色渲染基调 + shiki 墨色代码高亮（松烟墨正文、朱红关键字、竹青
   字符串、赭黄常量、灰墨注释）。
   color-scheme 供首屏（ThemePresenter 内联覆写之前）生效；客户端半边
   随后把内联 color-scheme 断言为 light，两者一致。 */
html[data-dsh-ink] {
  color-scheme: light;
  --shiki-foreground: rgb(28, 26, 23);
  --shiki-background: rgb(239, 231, 213);
  --shiki-token-constant: rgb(154, 108, 26);
  --shiki-token-string: rgb(61, 107, 79);
  --shiki-token-comment: rgb(138, 128, 114);
  --shiki-token-keyword: rgb(176, 58, 46);
  --shiki-token-parameter: rgb(140, 82, 30);
  --shiki-token-function: rgb(92, 85, 74);
  --shiki-token-string-expression: rgb(77, 127, 96);
  --shiki-token-punctuation: rgb(92, 85, 74);
  --shiki-token-link: rgb(176, 58, 46);
}

/* 动态特效层：浮于全部内容之上（对齐 openagents 水墨主题——粒子画在
   最上层），pointer-events 关闭不拦截交互；粒子透明度低且墨滴约束在
   屏幕四缘，不干扰阅读 */
#dsh-ink-fx {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  overflow: hidden;
}

/* 右上角朱红"墨"字闲章 + 其下枯笔飞白笔触（装饰元素由渲染器创建并
   挂入特效层，随卸载一并摘除） */
#dsh-ink-seal {
  position: absolute;
  right: 56px;
  top: 64px;
  width: 514px;
  height: 90px;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg transform='rotate(3 32 32)'%3E%3Crect x='8' y='8' width='48' height='48' rx='4' fill='%23b03a2e' opacity='0.75'/%3E%3Ctext x='32' y='43' font-size='26' text-anchor='middle' fill='%23faf6ec' font-family='serif'%3E%E5%A2%A8%3C/text%3E%3C/g%3E%3C/svg%3E"),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='90' viewBox='0 0 600 90'%3E%3Cg fill='%231c1a17'%3E%3Cpath d='M20 40 C140 30 300 26 580 34 C500 40 300 42 60 48 Z' opacity='0.14'/%3E%3Cpath d='M40 52 C200 46 380 44 560 50 C420 54 220 56 50 60 Z' opacity='0.1'/%3E%3Cpath d='M90 62 C240 58 400 57 530 62 C400 65 240 66 100 68 Z' opacity='0.07'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 64px 64px, 420px 63px;
  background-position: right 0 top 0, right 94px top 14px;
  background-repeat: no-repeat, no-repeat;
}

/* 墨滴竹叶画布：铺满特效层，透明底 */
#dsh-ink-canvas {
  display: block;
  width: 100%;
  height: 100%;
}`

    /* ==========================================
       dsh 水墨主题 — 水墨粒子渲染器（createInkRenderer 闭包控制器）
       移植自 openagents 水墨主题特效（theme_effects.js ink 分支）：
       偶数位粒子为四缘晕染墨滴（生长-消退-重生，径向渐变 + 偏移飞白晕圈），
       奇数位为飘落竹叶（尖细叶形，摆动旋转）。2D canvas 实现，无需 WebGL。

       契约：
         start()  创建/复用 #dsh-ink-fx（特效层，浮于内容之上）、
                         #dsh-ink-seal（朱红印章 + 枯笔飞白装饰）与
                         #dsh-ink-canvas（墨滴竹叶画布），并启动 30fps 限速
                         渲染循环；幂等，重复调用不产生第二层。
         stop()   停止循环并移除特效层（含印章与画布），不留 DOM 痕迹。
       渲染器不自动启动：工厂返回 { start, stop } 控制器，由客户端半边按主题激活状态启停。
       系统要求减少动态效果（prefers-reduced-motion）时降级为静态单帧。
       ========================================== */
    function createInkRenderer() {
      'use strict'

      /** 元素 id（与 STRUCTURE_CSS 的选择器一一对应）：特效层浮于内容之上，印章装饰与画布挂在其内。 */
      const FX_ID = 'dsh-ink-fx'
      const SEAL_ID = 'dsh-ink-seal'
      const CANVAS_ID = 'dsh-ink-canvas'

      /** 粒子总数（偶数墨滴 / 奇数竹叶各半，同 openagents 配置）。 */
      const PARTICLE_COUNT = 14

      /** 帧间隔上限：限制 30fps，降低 GPU/CPU 常驻开销（dt 按真实流逝计算，速度不受影响）。 */
      const FRAME_MS = 1000 / 30

      /** 系统要求减少动态效果时降级为静态单帧。 */
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      /** 渲染运行时状态（纯数据对象）。 */
      const rt = {
        running: false,
        raf: null,
        fx: null,
        canvas: null,
        ctx: null,
        parts: [],
        last: 0,
        onResize: null,
      }

      const rand = (min, max) => min + Math.random() * (max - min)

      /**
       * 生成单个粒子。墨滴只落在宣纸四缘（左右竖边/上下横边），避免出现在
       * 正文区形成污渍感；竹叶从任意水平位置飘落。
       */
      function makeParticle(w, h, seed) {
        const p = {
          x: rand(0, w), y: rand(0, h),
          phase: rand(0, Math.PI * 2),
          rot: rand(0, Math.PI * 2),
        }
        if (seed % 2 === 0) {
          // 晕染墨滴：生长-消退-重生（画布浮于内容之上，浓度取 openagents 原值）
          p.shape = 'drop'
          p.r = 0
          p.maxR = rand(24, 90)
          p.growSpeed = rand(10, 26)
          p.opacity = rand(0.1, 0.22)
          p.life = rand(4, 9)
          p.age = 0
          const edge = Math.floor(Math.random() * 4)
          if (edge === 0) p.x = rand(0, w * 0.14)
          else if (edge === 1) p.x = rand(w * 0.86, w)
          else if (edge === 2) p.y = rand(0, h * 0.18)
          else p.y = rand(h * 0.84, h)
        } else {
          // 飘落竹叶：摆动旋转下落
          p.shape = 'leaf'
          p.r = rand(4, 7)
          p.vy = rand(14, 30)
          p.sway = rand(20, 40)
          p.swaySpeed = rand(0.5, 1.1)
          p.rotSpeed = rand(-0.8, 0.8)
          p.color = '#3a4a3a'
          p.opacity = rand(0.25, 0.5)
          p.y = rand(-40, h)
        }
        return p
      }

      /** 绘制墨滴：径向渐变晕染，带偏移飞白晕圈。 */
      function drawInkDrop(ctx, p) {
        ctx.save()
        const fade = Math.max(1 - p.age / p.life, 0)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(p.r, 1))
        g.addColorStop(0, `rgba(28, 26, 23, ${(p.opacity * fade).toFixed(3)})`)
        g.addColorStop(0.7, `rgba(28, 26, 23, ${(p.opacity * fade * 0.5).toFixed(3)})`)
        g.addColorStop(1, 'rgba(28, 26, 23, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(p.r, 1), 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x + p.r * 0.3, p.y - p.r * 0.2, Math.max(p.r * 0.55, 1), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      /** 绘制竹叶：尖细椭圆叶形，随风摆动。 */
      function drawLeaf(ctx, p) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot + Math.sin(p.phase) * 0.4)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(0, -p.r * 1.8)
        ctx.quadraticCurveTo(p.r * 0.5, 0, 0, p.r * 1.8)
        ctx.quadraticCurveTo(-p.r * 0.5, 0, 0, -p.r * 1.8)
        ctx.fill()
        ctx.restore()
      }

      /** 推进并绘制全部粒子一帧。 */
      function step(dt) {
        const { ctx, canvas } = rt
        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)
        for (const p of rt.parts) {
          if (p.shape === 'drop') {
            // 墨滴：生长扩散随年龄消退，寿尽后在新位置重生（仍约束在四缘）
            p.age += dt
            p.r = Math.min(p.r + p.growSpeed * dt, p.maxR)
            if (p.age >= p.life) {
              p.age = 0
              p.r = 0
              p.x = Math.random() * w
              p.y = Math.random() * h
              const edge = Math.floor(Math.random() * 4)
              if (edge === 0) p.x = Math.random() * w * 0.14
              else if (edge === 1) p.x = w * 0.86 + Math.random() * w * 0.14
              else if (edge === 2) p.y = Math.random() * h * 0.18
              else p.y = h * 0.84 + Math.random() * h * 0.16
              p.maxR = 24 + Math.random() * 66
            }
            drawInkDrop(ctx, p)
          } else {
            // 竹叶：飘落摆动旋转，出底后回到顶部
            p.phase += p.swaySpeed * dt
            p.x += Math.sin(p.phase) * p.sway * dt
            p.y += p.vy * dt
            p.rot += p.rotSpeed * dt
            if (p.y > h + 30) {
              p.y = -30
              p.x = Math.random() * w
            }
            drawLeaf(ctx, p)
          }
        }
      }

      /** 渲染主循环：30fps 限速，未到帧间隔仅跳绘制不跳计时。 */
      function tick(now) {
        if (!rt.running) return
        rt.raf = requestAnimationFrame(tick)
        if (now - rt.last < FRAME_MS) return
        const dt = Math.min((now - rt.last) / 1000, 0.05)
        rt.last = now
        step(dt)
      }

      /** 同步画布像素尺寸到视口。 */
      function fitCanvas() {
        rt.canvas.width = window.innerWidth
        rt.canvas.height = window.innerHeight
      }

      /**
       * 启动水墨渲染：创建/复用特效层（浮于内容之上）、印章装饰与画布，
       * 生成粒子并启动循环。幂等。
       * reducedMotion 下只绘制一帧静态画面（墨滴停在半晕染状态）。
       */
      function start() {
        if (rt.running) return
        let fx = document.getElementById(FX_ID)
        if (fx === null) {
          fx = document.createElement('div')
          fx.id = FX_ID
          fx.setAttribute('aria-hidden', 'true')
          document.body.appendChild(fx)
        }
        if (document.getElementById(SEAL_ID) === null) {
          const seal = document.createElement('div')
          seal.id = SEAL_ID
          fx.appendChild(seal)
        }
        let canvas = document.getElementById(CANVAS_ID)
        if (canvas === null) {
          canvas = document.createElement('canvas')
          canvas.id = CANVAS_ID
          fx.appendChild(canvas)
        }
        rt.fx = fx
        rt.canvas = canvas
        rt.ctx = canvas.getContext('2d')
        if (rt.ctx === null) return
        fitCanvas()
        rt.onResize = fitCanvas
        window.addEventListener('resize', rt.onResize)
        rt.parts = []
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          rt.parts.push(makeParticle(canvas.width, canvas.height, i))
        }
        if (reducedMotion) {
          // 降级：墨滴画在半晕染状态，画一帧即停
          for (const p of rt.parts) {
            if (p.shape === 'drop') {
              p.age = p.life * 0.4
              p.r = p.maxR * 0.6
            }
          }
          step(0)
          return
        }
        rt.running = true
        rt.last = performance.now()
        rt.raf = requestAnimationFrame(tick)
      }

      /** 停止渲染：取消循环、摘除特效层（含印章与画布），不留 DOM 痕迹。 */
      function stop() {
        rt.running = false
        if (rt.raf !== null) {
          cancelAnimationFrame(rt.raf)
          rt.raf = null
        }
        if (rt.onResize !== null) {
          window.removeEventListener('resize', rt.onResize)
          rt.onResize = null
        }
        rt.parts = []
        if (rt.fx !== null) {
          rt.fx.remove()
          rt.fx = null
          rt.canvas = null
          rt.ctx = null
        }
      }

      return { start, stop }
    }

    /**
     * 客户端插件体：叠令牌覆盖层、断言浅色渲染基调、挂载结构层样式与
     * 水墨粒子渲染器，卸载时全部还原。
     * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端 cordis 上下文。
     */
    function apply(ctx) {
      let disposed = false

      // 1. 令牌覆盖层：叠在当前主题之上，卸载随纤维回收自动移除并还原
      ctx.effect(() => ctx.theme.overrideTokens(SOURCE, TOKENS), 'theme-ink: token overlay')

      // 2. 浅色渲染基调：ThemePresenter 每次发布按偏好重写 color-scheme 与
      //    暗色基底属性，本监听器运行于其后重新断言为 light（只改呈现）。
      //    已覆盖令牌之外的基底令牌需要浅色基底兜底，否则深色偏好下露深色底
      const assertLightChrome = () => {
        if (disposed) return
        document.documentElement.style.colorScheme = 'light'
        document.body.removeAttribute(DARK_ATTRIBUTE)
      }
      assertLightChrome()
      ctx.on('theme/change', assertLightChrome)

      // 3. 结构层：html 门控属性 + 内联样式表 + 水墨渲染器（模块内闭包，
      //    无全局控制器、无脚本加载竞态）。字体沿用 dsh 自身字体，主题不做覆写
      document.documentElement.setAttribute(MARK, '')
      const style = document.createElement('style')
      style.setAttribute(MARK, '')
      style.textContent = STRUCTURE_CSS
      document.head.appendChild(style)
      const renderer = createInkRenderer()
      renderer.start()

      // 卸载回收：还原渲染基调到当前偏好解析结果，摘除全部 DOM 痕迹。
      // disposed 先于覆盖层移除置位，使移除发布的 theme/change 不再触发断言；
      // 无论纤维内各 effect 的处置顺序如何，最终状态都收敛到偏好本真值
      ctx.effect(() => () => {
        disposed = true
        const scheme = ctx.theme.getTheme().active.colorScheme
        document.documentElement.style.colorScheme = scheme
        if (scheme === 'dark') document.body.setAttribute(DARK_ATTRIBUTE, '')
        else document.body.removeAttribute(DARK_ATTRIBUTE)
        document.documentElement.removeAttribute(MARK)
        style.remove()
        renderer.stop()
      }, 'theme-ink: teardown')
    }

    /** 客户端半边依赖的服务（与 package.json dsh.client.inject 的包一一对应）。 */
    const inject = ['theme']

    return { inject, apply }
  },
})