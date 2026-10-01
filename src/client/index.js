// ==========================================
// dsh-theme-ink — 客户端半边（免构建 client bundle）
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
//   3. 结构层视觉：html[data-dsh-ink] 门控属性、样式表 link 与
//      window.DshInk 渲染器的挂载/启停。
// ==========================================
window.__ModuleLoader__.load({
  id: 'dsh-theme-ink',
  factory: () => {
    'use strict'

    /** 令牌覆盖层 source 标识（动态包门面会改钉为包 id，此处为直装插件路径）。 */
    const SOURCE = 'ink'

    /** 激活标记：html 属性门控 ink.css 结构层；link 标签携带同名标记便于认领。 */
    const MARK = 'data-dsh-ink'
    const STYLE_URL = '/ink/ink.css'
    const SCRIPT_URL = '/ink/ink.js'

    /** ui-layout ThemePresenter 按偏好维护的暗色基底属性（呈现层，只读其契约）。 */
    const DARK_ATTRIBUTE = 'data-ds-dark-theme'

    /**
     * 宣纸水墨调色板：令牌名 → 单套色值。面板为不透明宣纸实色，纸色由
     * 面板自身承担（无底层背景）；装饰（印章/飞白/墨滴/竹叶）由 ink.js
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

    /**
     * 客户端插件体：叠令牌覆盖层、断言浅色渲染基调、挂载结构层视觉，
     * 卸载时全部还原。
     * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端 cordis 上下文。
     */
    function apply(ctx) {
      let disposed = false
      let scriptLoading = false

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

      // 3. 结构层：html 门控属性 + 样式表 + 水墨渲染器。
      //    Host 首屏引导可能已注入同一 link（携带标记），认领而非重复插入。
      //    字体沿用 dsh 自身字体，主题不做覆写。
      document.documentElement.setAttribute(MARK, '')
      if (document.querySelector(`link[${MARK}]`) === null) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = STYLE_URL
        link.setAttribute(MARK, '')
        document.head.appendChild(link)
      }
      if (window.DshInk !== undefined) {
        window.DshInk.start()
      } else if (!scriptLoading) {
        scriptLoading = true
        const script = document.createElement('script')
        script.src = SCRIPT_URL
        script.setAttribute(MARK, '')
        script.onload = () => {
          scriptLoading = false
          // 加载完成前插件已卸载则不启动
          if (!disposed && window.DshInk !== undefined) window.DshInk.start()
        }
        script.onerror = () => { scriptLoading = false }
        document.head.appendChild(script)
      }

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
        const link = document.querySelector(`link[${MARK}]`)
        if (link !== null) link.remove()
        const script = document.querySelector(`script[${MARK}]`)
        if (script !== null) script.remove()
        if (window.DshInk !== undefined) window.DshInk.stop()
      }, 'theme-ink: teardown')
    }

    /** 客户端半边依赖的服务（与 package.json dsh.client.inject 的包一一对应）。 */
    const inject = ['theme']

    return { inject, apply }
  },
})
