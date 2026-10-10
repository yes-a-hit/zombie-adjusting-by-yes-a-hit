# 引擎笔记

本模组每条改动对应的引擎事实，逐条核对而来，**不是推测**。
改动 `scripts/main.js` 的挂载点之前，先回这里对照。

> **来源与引用**
> 本文件是对 PvZ2 Gardendless 运行期行为的**互操作性观察笔记**，
> 用于让本模组正确地与目标软件配合，**不复制其源代码**。
> 文中摘录的少量标识符与实现片段，是为说明互操作所必需的**最小引用**，
> 版权归原项目 `Gzh0821/pvzge_web` 及其权利人所有；本仓库不分发该项目的任何文件。
> 完整声明见 [`NOTICE.md`](../NOTICE.md)。

**来源**：`Gzh0821/pvzge_web` 仓库的 `docs/assets/main/index.js`（未压缩 bundle，可直接 grep）。

---

## 挂载点总表

| # | 目标 | 引擎类 | 方法 | 模式 |
|---|---|---|---|---|
| 2 | 重金属巨人 | `EightiesGargantuarZombie` | `onSmashing` | 拦截 |
| 3 | 街机游戏机 | `EightiesArcadeCabinet` | `specialTombUpdate` | 改池 + 自扣 |
| 4 | 轮滑（闪耀） | `EightiesGlitterZombie` | `whenStabbedBySpikeWeed` | 秒杀 |
| 5 | 霹雳舞 | `EightiesBreakDancerZombie` | `kick` | 限一只 + 自扣 |
| 6 | 麦克说唱家 | `EightiesMCZombie` | `attack` | 事后自伤 |
| 7 | 失落巨人 | `LostcityGargantuarZombie` | `specialGargantuarUpdate` | 持续焚烧 |
| 8 | 章鱼僵尸 | `BeachOctopusZombie` | `_throw` | 事后自伤 |
| 9 | 弄臣 | `DarkJesterZombie` | `specialZombieUpdate` | 持续掉血 |
| 10 | 机甲路障 | `FutureMechConeZombie` | `playDie` / `judgeDeath` / `onDamagedToHealth0` | 死亡自爆 |
| 10 | 机甲橄榄球盔 | `FutureMechFootballZombie` | 同上 | 死亡自爆 |
| 10 | 巨尸统领者 | `FutureGargantuarZombie` | 同上 | 死亡自爆 |

共 **11 条目标 / 17 个方法入口**（未来三只各 3 个入口）。

---

## 1. 小鬼血量（数据补丁）

18 只带独立 props 的小鬼，`Toughness` 统一改成 95。
`jsons/objects/ZombieProps.json` 用 `aliases[0]` 定位条目，
**只写要改的字段**，其余由 merge 保留。

两个例外：

- **小鬼炮**（`kongfu_*_cannon` 一类）是炮台装置，没有独立血量条目，不在名单里；
- **节日系九只小鬼**没有自己的 props，会跟随普通小鬼一起变 95。

## 2. 重金属巨人 · 音波 AOE

基类 `GargantuarZombie` 的 `onSmashing` 是空函数，砸植物走 `_smash()`（`SmashDamage`）。

八十年代表演世界**覆写**了它：

```js
onSmashing() { 播放音效; shootOnePea(WaveType = 'eighties_gargantuar_wave') }
```

那颗波投射物在 `ProjectileProps` 里 `Damage = 1000` —— 这就是它的 AOE。

⇒ **拦掉 `onSmashing` 即可去掉 AOE**，普通砸击（1500）走的是另一条路径，分毫不动。

## 3. 街机游戏机 · 召唤池与自扣血

`EightiesArcadeCabinet`（游戏机本体，挂在墓碑/道具池里）的召唤逻辑在 `specialTombUpdate`：

```js
this.summonCD -= dt;
this.summonCD <= 0 && (this.summonCD = getRandom(SummonInterval); SpawnZombieByZombieType(...))
```

默认召唤池 `SummonnedZombies = [60% eighties_8bit, 30% eighties_8bit_armor1, 10% eighties_8bit_armor2]`。

⇒ 把 `eighties_8bit_armor2`（像素铁桶）从**实例的**池子里摘掉，并在召唤发生时自扣血。

**召唤的判定**：`callNext` 之前 CD 已耗尽（`before > 0 && before - dt <= 0`），
之后 CD 被重置成新的随机值 —— 用这个特征区分"刚召唤过"与"同一帧的其它调用"。

## 4. 轮滑（闪耀）僵尸 · 地刺秒杀

引擎给僵尸的钩子是 `whenStabbedBySpikeWeed(spikeweeds)`。
载具类（钢琴、弹射器、滚桶、雪橇）统一是这一套：

```js
this.playDie()
spikeweeds.forEach(sw => sw.normalSmash(this))
```

闪耀僵尸**没有覆写**这个方法，所以照抄这套写法即可。

## 5. 霹雳舞僵尸 · 一次只踢一只

`kick()` 原本对 1.5 格矩形内**所有**可踢僵尸 `forEach` 做 `leapBy`。

⇒ 换成"只挑一只"（`pool.find(...)`），踢到一只后自己掉 50 血；空踢不扣。

踢飞用的是 `target.leapBy(dir, true, 0.5, 40, true, false, true)`，
方向取自 `objdataOwn.KickDistance × (reversed ? 1 : -1)`。

## 6. 麦克说唱家 · 甩完麦自杀

甩麦走 `specialAnimationListener` 的 `"attack"` 事件 → `attack()`（`JamAttackDamage = 2001`）。

⇒ 在 `attack` **之后**给自己一发致死伤害。用 `dead` 标记避免重复结算。

## 7. 失落巨人 · 火把持续焚烧

它自带 `ignited`（火把状态，默认 true，被冰冻/减速会熄灭）与 `FireDamage`。

沙漠探险家的焚烧实现在 `detectPlantWithTorch`：对 `plantDetectorRec` 内的植物/墓碑
按 `FireDPS × dt` 施加 `fire` 类型伤害。

⇒ 每帧只要 `ignited`，就对身前矩形内的植物/墓碑施加同样的 fire 伤害（**无需攻击动作**）。
拿不到 `plantDetectorRec` 时，退化为"自身前方半格为中心、一格宽的矩形"。

## 8. 章鱼僵尸 · 投掷自扣

投掷走 `specialAnimationListener` 的 `"throw"` 事件 → `_throw()`。

⇒ `_throw` 之后自扣 150。与麦克不同，这一条**不做存活判断**——
每次投掷都扣，投两次扣两次。

## 9. 弄臣 · 旋转掉血

`specialZombieUpdate` 里维护 `rotating` 状态。

⇒ `rotating` 为真时按 `每秒 20 × dt` 持续掉血（1.0.1 由 30 下调）。

## 10. 未来三只 · 死亡自爆

三只的死亡统一走基类 `Zombie.playDie()`，但不同死法可能先经过
`judgeDeath`（死亡动画）或 `onDamagedToHealth0`（血量归零）。

⇒ **三个入口同时挂**，共用一个 `__funAdjustBombed` 标记，谁先到谁触发，同一次死亡只炸一次。

### 范围判定的两层降级

1. **引擎矩形**：`Rectangle.createRectangleCenter` + `judgeCrossRec`，
   与功夫自爆僵尸同一套；
2. **距离近似**：拿不到 `Rectangle` 时，改用 `|植物.x − 自身.x| ≤ 一格`。

每次自爆都写一行日志：

```
自爆：未来三只·死后自爆 命中 3 株植物（路径=引擎矩形，半径 1 格，伤害 1800；场上植物 7 株）
```

失败也写清楚卡在哪：拿不到 `ZombieDamageDetails` / 拿不到 `inLane.plantPool()`。

> **1.0.0 的教训**：那一版只有第 ① 层，拿不到 `Rectangle` 就静默什么都不做、
> 日志里也不留痕，用户只能看到"没反应"。**降级路径必须可观测**。

---

## 类定位与钩子装配

### 多路定位

`locateClass` 按副作用从小到大依次尝试：

1. `engine.getModuleExport(modulePath, name)`
2. `cc.js.getClassByName(name)` 与 `engine.getClassByName(name)`

并且**要求原型上真有目标方法**，借此把门面类、同名干扰类自动剔掉。
目标方法可能是继承来的，此时退一步只看 `prototype` 是否存在。

### 继承方法的固化

`installHook` 在包装前会调 `materializeInherited`：
若方法来自原型链上游（`hasOwnProperty` 为假），先在**当前原型**上固化一份自有实现，
再对它做包装 —— 避免把父类一起污染。

### 包装的双通道

优先用 GP-Next 的 `ctx.unsafe.hooks.wrapMethod`；它抛错时退回直接改写原型。
两条路都会写入诊断，日志里能看出走的是哪条。

---

## 关键字段所在文件

| 内容 | 文件 |
|---|---|
| 僵尸 codename / 名称 | `Features\ZombieFeatures.json` |
| 僵尸数值（`Toughness` / 各种 Interval） | `Objects\ZombieProps.json` |
| 投射物伤害与效果 | `Objects\ProjectileProps.json` |
| 僵尸图鉴文本 | `Objects\ZombieAlmanac.json` |

**注意**：`Interval` 类字段既可能是数字，也可能是 `{ Min, Max }` 范围对象，
引擎侧走 `getRandomFromRange`。改的时候保持原结构类型。

---

## v1.1.0 新增条目的引擎依据

### 脉冲黄桃强制落地飞机

- 脉冲黄桃对范围内目标调用 **`zombie.empStun(duration)`**，而**基类 `Zombie.empStun` 是空函数**。
  全引擎只有 12 处覆写：`BeachSurferZombie` / `CowboyBullZombie` / `EightiesArcadeCabinet` /
  `FutureImpZombie` / `KongfuBoss{Blade,Chi,Explode}Zombie` / `MechZombie` /
  **`SkyDroneZombie`** / `Tomb` / `Zombie` / `ZombossMechZombie` —— 飞行僵尸里**仅有无人机**有份。
- 「强制落地」的正统写法：`flying` 是带副作用的访问器，从 `true` 变 `false`
  会触发 `onLanding()` → `specialZombieOnLandingForced()`。
  `SkyImpZombie` 自带样例 `playSpecialZombieDieForced() { this.flying = false }`。
- 目标六类：`SkyImpZombie` / `SkyBattlePlaneZombie` / `SkyTwinUpperZombie` /
  `SkyTwinLowerZombie` / `SkyDroneZombie` / `SkyArbiterXZombie`。**僵王不在内**。

### 重金属巨人舞台效果减伤

- `EightiesGargantuarProps` 的舞台效果由 `isInJam` 判定。
- 减伤走 `extraDamageScale` —— `defaultDealDamage` 结算链上的一环，
  返回值会乘进最终伤害；返回 `0.5` 即「承受伤害减半」。
  （火龙小鬼免疫火焰靠它返回 `0`，同一套机制。）
- 音波在 `onSmashing` 里经 `shootOnePea(WaveType)` 射出，**整体拦掉该方法**即可，
  普通砸击走的是 `_smash()` 内部另一条路径，不受影响。

### 像素僵尸破防伤害

- `eighties_8bit` 是 `ZombieEnum` 值（**334**），**没有专属引擎类** → 只能按 ID 过滤。
- `Zombie.prototype.characterUpdate` 的覆写者只有 `Character` 与 `Zombie` 自身，
  **没有任何僵尸子类覆写它** → 安全的每帧入口（对比植物侧 `specialPlantUpdate` 的坑）。
- `defaultDealDamage` 中若 `!t.armorProtection` 为真，则**直接扣主体 `health`**、完全跳过防具。

### 冰系免疫

- 冰冻下发口 `Zombie.setFreeze(seconds, flag)`，内部按 `objdataOwn.ChillInsteadOfFreeze`
  或 `flying` 决定走减速还是真冰冻；减速下发口 `Zombie.setChill(seconds)`。
- ID：`iceage_weasel` = **228**（冰鼬）、`iceage_imp` = **229**（雪人小鬼）。

### 蜻蜓护甲

- 蜻蜓僵尸（`lostcity_bug`）的 `Toughness` = 190 是**僵尸本体**；
  **`BugToughness` = 350 才是背上那只蜻蜓（防具）**；另 `BuggedSPS` = 0.4。
- 由 `LostcityBasicZombie` 持有，四个变体一并下调。

### 数据字段速查（v1.1.0 新增）

| 内容 | 字段 | 所在文件 |
|---|---|---|
| 小鬼血量 | `Toughness` | `Objects\ZombieProps.json` |
| **蜻蜓护甲血量** | `BugToughness` | `Objects\ZombieProps.json` |
| 被蜻蜓附着时的速度 | `BuggedSPS` | `Objects\ZombieProps.json` |
| 僵尸的世界归属 | `OBTAINWORLD` | `Features\ZombieFeatures.json` |
