/**
 * 交付物一致性断言：清单字段、小鬼血量补丁、许可与声明。
 * 默认校验仓库根；设置 JBTMG_PKG_ROOT 后可校验任意解包目录（用于验证发布的 ZIP）。
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ok, section } from './harness.mjs'

export function runPackage({ pkgRoot }) {
  section('E. 包内容一致性')
  console.log(`  （校验目录：${pkgRoot}）`)

  const at = (rel) => path.join(pkgRoot, rel)

  // ── 清单 ──
  const packJson = JSON.parse(readFileSync(at('pack.json'), 'utf8'))
  ok(packJson.uuid === 'yg.zombie-fun-adjust', 'uuid 正确', packJson.uuid)
  ok(packJson.version === '1.2.6', 'version = 1.2.6', packJson.version)
  ok(packJson.apiVersion === 2, 'apiVersion = 2')
  ok(packJson.js && packJson.js.startup === true, 'js.startup = true（engine 访问权前提）')
  ok(!('requiredGpNextFeatures' in packJson), '未声明 requiredGpNextFeatures（本版本会拒绝加载）')
  ok(packJson.js.entry === 'scripts/main.js', 'js.entry 指向 scripts/main.js')
  ok(packJson.author === 'YG', 'author 正确')
  ok(!('depends' in packJson) && !('optionalDepends' in packJson), '无额外前置依赖')

  // ── 数据补丁：小鬼血量 ──
  const props = JSON.parse(readFileSync(at('jsons/objects/ZombieProps.json'), 'utf8'))
  const impEntries = props.objects.filter((o) => o.objdata && o.objdata.Toughness !== undefined)
  const bugEntries = props.objects.filter((o) => o.objdata && o.objdata.BugToughness !== undefined)
  ok(props.objects.length === 25, '血量补丁共 25 条（18 小鬼 + 7 蜻蜓/萤火虫护甲）', String(props.objects.length))
  ok(props.objects.every((o) => o.objclass === 'ZombieProperties'), 'objclass 全部为 ZombieProperties')
  ok(impEntries.length === 18 && impEntries.every((o) => o.objdata.Toughness === 95),
    '18 条小鬼全部 Toughness = 95',
    JSON.stringify(impEntries.filter((o) => o.objdata.Toughness !== 95).map((o) => o.aliases[0])))
  ok(bugEntries.length === 7 && bugEntries.every((o) => o.objdata.BugToughness === 90),
    '7 条蜻蜓/萤火虫护甲全部 BugToughness = 90（原 350）',
    JSON.stringify(bugEntries.map((o) => `${o.aliases[0]}=${o.objdata.BugToughness}`)))

  // ── 数据补丁：植物（魔音甜菜防踢飞）──
  const pprops = JSON.parse(readFileSync(at('jsons/objects/PlantProps.json'), 'utf8'))
  ok(pprops.objects.length === 2, '植物补丁 2 条（魔音甜菜 + 音游甜菜）', String(pprops.objects.length))
  ok(pprops.objects.every((o) => o.objclass === 'PlantProperties'), 'objclass 全部为 PlantProperties')
  ok(pprops.objects.every((o) => o.objdata.CannotBePushedByFootballMech === true),
    '魔音甜菜系列已加入防踢飞字段（与白萝卜 turnip 同一字段）',
    JSON.stringify(pprops.objects.map((o) => o.aliases[0])))

  const names = props.objects.map((o) => o.aliases[0])
  const mustHave = ['tutorial_imp', 'egypt_imp', 'future_imp', 'lostcity_imp', 'dino_imp', 'sky_imp']
  for (const n of mustHave) ok(names.includes(n), `名单含 ${n}`)
  ok(new Set(names).size === names.length, '补丁里没有重复条目')
  ok(props.objects.every((o) => Array.isArray(o.aliases) && o.aliases.length === 1),
    '每条只有一个 alias（gp-next 按 aliases[0] 定位）')

  // ── 许可与声明 ──
  ok(existsSync(at('LICENSE')), 'LICENSE 存在')
  ok(existsSync(at('NOTICE.md')), 'NOTICE.md 存在')

  const license = readFileSync(at('LICENSE'), 'utf8')
  ok(license.startsWith('MIT License'), 'LICENSE 以标准标题开头')
  ok(license.includes('Copyright (c) 2026 YG'), 'LICENSE 含版权行')
  ok(license.trim().endsWith('SOFTWARE.'), 'LICENSE 以标准 MIT 全文结尾，未追加附加条款')

  const notice = readFileSync(at('NOTICE.md'), 'utf8')
  ok(notice.includes('不含任何第三方模组代码'), 'NOTICE 声明不含第三方模组代码')
  ok(notice.includes('互操作'), 'NOTICE 说明游戏数据的互操作性边界')
  ok(notice.includes('商标'), 'NOTICE 覆盖商标归属')

  // ── 文档口径 ──
  const readme = readFileSync(at('README.md'), 'utf8')
  ok(readme.includes('NOTICE.md'), 'README 指向 NOTICE.md')
  ok(readme.includes('不需要任何额外脚本'), 'README 明确说明无需额外脚本')
  ok(!/fix-mod-startup|点\s*bat/i.test(readme), 'README 不含「点 bat」式安装指引')

  const installPath = at('docs/INSTALL.md')
  if (existsSync(installPath)) {
    const install = readFileSync(installPath, 'utf8')
    ok(!/fix-mod-startup|点\s*bat|回来找作者/i.test(install), 'INSTALL.md 不含「点 bat / 回来找作者」式指引')
    ok(install.includes('不需要任何额外脚本'), 'INSTALL.md 明确说明无需额外脚本')
    ok(install.includes('与本模组无关'), 'INSTALL.md 把 afterProject 归因到环境而非本模组')
  }
}
