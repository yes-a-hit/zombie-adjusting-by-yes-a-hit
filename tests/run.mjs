/**
 * 测试入口：装配运行期、跑全部 suite、汇总退出码。
 *
 * 用法：
 *   node tests/run.mjs                       # 校验仓库根
 *   JBTMG_PKG_ROOT=<dir> node tests/run.mjs  # 校验解包目录
 *   JBTMG_ENTRY=<file>   node tests/run.mjs  # 指定要加载的模组入口
 *
 * 后两个环境变量由 tools/pack.ps1 在打包后做「用发布产物复测」时使用。
 */
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { ok, section, summary, makeCtx } from './harness.mjs'
import { runZombies } from './suite-zombies.mjs'
import { runPackage } from './suite-package.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const pkgRoot = process.env.JBTMG_PKG_ROOT
  ? path.resolve(process.env.JBTMG_PKG_ROOT)
  : repoRoot
const entryFile = process.env.JBTMG_ENTRY
  ? path.resolve(process.env.JBTMG_ENTRY)
  : path.join(repoRoot, 'scripts', 'main.js')
const entryUrl = pathToFileURL(entryFile).href

const entryMod = await import(entryUrl)
const mod = entryMod.default
const T = entryMod.__test__

section('0. 入口与导出')
console.log(`  （入口：${entryFile}）`)

ok(typeof mod === 'object' && typeof mod.startup === 'function' && typeof mod.setup === 'function',
  '入口导出 startup / setup')
ok(!!T, '__test__ 可访问（供本套测试读取内部状态）')
ok(!!T.CFG && !!T.TARGETS, '__test__ 暴露 CFG 与 TARGETS')
ok(typeof T.makeHandler === 'function' && typeof T.setRefs === 'function', '__test__ 暴露钩子与依赖注入')

// 十条改动
runZombies({ T, mod })

// 交付物
runPackage({ pkgRoot })

// 宿主环境残缺时不抛（真实 setup 路径的兜底）
section('12. 宿主兜底')
{
  const mod2 = await import(entryUrl + '?v=bare')
  const logs = []
  const bare = {
    log: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
    ui: { toast: () => {} },
  }
  let threw = false
  try {
    mod2.default.startup(bare)
    mod2.default.setup(bare)
  } catch (e) { threw = true; console.log('    (异常: ' + e.message + ')') }
  ok(!threw, '宿主只有 log / ui 时 startup + setup 不抛异常')

  const bare2 = { log: { info: () => {}, warn: () => {}, error: () => {} }, ui: { toast: () => {} }, controls: { definePanel: () => {} } }
  let threw2 = false
  try { mod2.default.setup(bare2) } catch (e) { threw2 = true }
  ok(!threw2, '缺少 unsafe.hooks 时 setup 不抛异常')

  ok(makeCtx() !== null, '测试用 ModContext 工厂可用')
}

summary()
