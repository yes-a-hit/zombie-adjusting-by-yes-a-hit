/**
 * 测试脚手架：断言器 + 假引擎 + 假僵尸/植物/车道 + ModContext 工厂。
 *
 * 假类里的方法名严格照 scripts/main.js 顶部那段「引擎事实」注释核对过的表，
 * 改表之前先回 docs/ENGINE-NOTES.md 确认，否则会出现「测试通过、真机不触发」。
 */

// ─────────────────────── 断言器 ───────────────────────

export const counters = { pass: 0, failures: [] }

export function ok(cond, label, extra) {
  if (cond) {
    counters.pass += 1
    console.log(`  ✅ ${label}`)
  } else {
    counters.failures.push(label + (extra ? ` :: ${extra}` : ''))
    console.log(`  ❌ ${label}${extra ? ' :: ' + extra : ''}`)
  }
}

export function near(actual, expected, tol, label) {
  const diff = Math.abs(actual - expected)
  ok(diff <= tol, label, `实际 ${actual} 期望 ${expected} 容差 ${tol}`)
}

export function section(title) {
  console.log(`\n===== ${title} =====`)
}

export function summary() {
  console.log('\n' + '='.repeat(52))
  console.log(`通过 ${counters.pass} 项，失败 ${counters.failures.length} 项`)
  if (counters.failures.length) {
    console.log('失败明细：')
    for (const f of counters.failures) console.log('  · ' + f)
    process.exitCode = 1
  } else {
    console.log('全部断言通过 ✅')
  }
  console.log('='.repeat(52))
  return counters.failures.length === 0
}

// ─────────────────────── 假引擎依赖 ───────────────────────

export class Vec2 {
  constructor(x, y) { this.x = x; this.y = y }
}

export class ZombieDamageDetails {
  constructor(amount, a, b, c, d, type) {
    this.amount = amount
    this.damage = amount
    this.type = type
    this.raw = [amount, a, b, c, d, type]
  }
}

/** ZombieDamageType 在引擎里是个枚举对象，不是函数 */
export const ZombieDamageType = { fire: 'fire', physicle: 'physicle', electricity: 'electricity' }

export const Square = { SquareWidth: 68, SquareHeight: 80.77 }

/**
 * 引擎的 Rectangle：createRectangleCenter(center, w, h) 返回一个带 judgeCrossRec 的矩形。
 * 测试里用「中心距 ≤ 半宽」做判定，和 main.js 的距离近似分支保持一致的语义。
 */
export const Rectangle = {
  createRectangleCenter(center, w, h) {
    const halfW = w / 2
    const halfH = h / 2
    return {
      center, w, h,
      judgeCrossRec(rec) {
        if (!rec) return false
        const dx = Math.abs((rec.x ?? rec.center?.x ?? 0) - center.x)
        const dy = Math.abs((rec.y ?? rec.center?.y ?? 0) - center.y)
        return dx <= halfW && dy <= halfH
      },
    }
  },
}

export function makeRefs() {
  return {
    cc: { Vec2 },
    Vec2,
    Rectangle,
    Square,
    ZombieDamageDetails,
    ZombieDamageType,
  }
}

// ─────────────────────── 假实体 ───────────────────────

export class FakeZombie {
  constructor(over = {}) {
    Object.assign(this, {
      dead: false,
      hypnotized: false,
      reversed: false,
      rotating: false,
      ignited: false,
      worldPositionX: 0,
      worldPositionY: 0,
      objdataOwn: {},
      inLane: null,
    }, over)
    this.damageTaken = []
    this.playDieCalls = 0
    this.leapByCalls = []
  }
  dealDamage(d) {
    this.damageTaken.push(d && typeof d === 'object' ? d.amount : d)
    if (d && d.amount >= 999999) this.dead = true
  }
  playDie() { this.playDieCalls += 1; this.dead = true }
  leapBy(...a) { this.leapByCalls.push(a) }
}

export class FakePlant {
  constructor(x, y) {
    this.worldPositionX = x
    this.worldPositionY = y
    this.bodyRec = { x, y }
    this.damageTaken = []
  }
  dealDamage(d) { this.damageTaken.push(d && typeof d === 'object' ? d.amount : d) }
}

export class FakeTomb extends FakePlant {}

class FakeSquare {
  constructor(x, y) { this.x = x; this.y = y; this.bodyRec = { x, y } }
}

/** 一条车道；三个池子都用函数形式，和引擎一致 */
export function makeLane({ plants = [], tombs = [], zombies = [], hypno = [], midY = 40 } = {}) {
  const squares = plants.map((p) => new FakeSquare(p.worldPositionX, p.worldPositionY))
  return {
    midY,
    plants,
    tombs,
    zombies,
    hypno,
    plantPool: () => plants,
    tombPool: () => tombs,
    zombiePool: () => zombies,
    hypnoZombiePool: () => hypno,
    getAllPlants: () => plants,
    squares,
  }
}

/** 造一个带 callNext 记录的钩子调用上下文 */
export function callCtx(thisArg, args) {
  const calls = []
  return {
    calls,
    ctx: {
      thisArg,
      args: args || [],
      callNext: (...a) => { calls.push(a); return 'NEXT' },
    },
  }
}

// ─────────────────────── 假 ModContext ───────────────────────

export function makeCtx(over = {}) {
  const logs = []
  const toasts = []
  const panels = []
  const base = {
    engine: {
      getCc: () => ({ js: { getClassByName: () => null }, Vec2 }),
      getClassByName: () => null,
      getModuleExport: () => null,
    },
    unsafe: {
      hooks: {
        wrapMethod({ target, methodName, handler }) {
          const orig = target[methodName]
          if (typeof orig !== 'function') throw new Error('原型上没有 ' + methodName)
          target[methodName] = function (...a) {
            return handler({ thisArg: this, args: a, callNext: (...x) => orig.apply(this, x) })
          }
        },
      },
    },
    advanced: {},
    log: {
      info: (m) => logs.push(['info', m]),
      warn: (m) => logs.push(['warn', m]),
      error: (m) => logs.push(['error', m]),
    },
    ui: { toast: (m, t) => toasts.push([t, m]) },
    controls: { definePanel: (p) => panels.push(p) },
    _logs: logs,
    _toasts: toasts,
    _panels: panels,
  }
  return Object.assign(base, over)
}
