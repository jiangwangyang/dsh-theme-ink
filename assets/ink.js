/* ==========================================
   dsh 水墨主题 — 水墨粒子渲染器（window.DshInk 控制器）
   移植自 openagents 水墨主题特效（theme_effects.js ink 分支）：
   偶数位粒子为四缘晕染墨滴（生长-消退-重生，径向渐变 + 偏移飞白晕圈），
   奇数位为飘落竹叶（尖细叶形，摆动旋转）。2D canvas 实现，无需 WebGL。

   契约：
     DshInk.start()  创建/复用 #dsh-ink-fx（特效层，浮于内容之上）、
                     #dsh-ink-seal（朱红印章 + 枯笔飞白装饰）与
                     #dsh-ink-canvas（墨滴竹叶画布），并启动 30fps 限速
                     渲染循环；幂等，重复调用不产生第二层。
     DshInk.stop()   停止循环并移除特效层（含印章与画布），不留 DOM 痕迹。
   本脚本只定义控制器，不自动启动（由客户端半边或首屏引导决定时机）。
   系统要求减少动态效果（prefers-reduced-motion）时降级为静态单帧。
   ========================================== */
;(function () {
  'use strict'

  /** 元素 id（与 ink.css 的选择器一一对应）：特效层浮于内容之上，印章装饰与画布挂在其内。 */
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

  window.DshInk = { start, stop }
})()
