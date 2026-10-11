# tests

模拟验收测试。不需要游戏本体，用假类还原引擎结构，在 node 里跑。

```bash
npm test          # 等价于 node tests/run.mjs
```

## 为什么要用假类而不是直接跑游戏

模组的核心逻辑是「钩子挂在哪、什么条件下改、什么时候还原」。
这些在没有引擎的情况下完全可测——只要假类的**类名、方法名、事件名**与真机一致。

`harness.mjs` 里那张表是照 `docs/ENGINE-NOTES.md` 逐条核对过的。
**改这张表之前先回引擎确认**，否则会出现「测试通过、真机不触发」这种最贵的失败。

## 文件

| 文件 | 作用 |
|---|---|
| `harness.mjs` | 断言器 + 假引擎依赖（Rectangle / Vec2 / Square / ZombieDamageDetails）+ 假僵尸/植物/车道 + ModContext 工厂 |
| `suite-zombies.mjs` | 十条改动的行为断言（8 种行为模式） |
| `suite-package.mjs` | 交付物一致性：清单字段、小鬼血量补丁、许可与声明 |
| `run.mjs` | 装配运行期、依次执行各 suite、汇总退出码 |

## 覆盖范围

- **配置**：`CFG` 的每个数值、`TARGETS` 的条数与入口数
- **行为**：拦截 / 改池 / 秒杀 / 限一只 / 事后自伤 / 持续焚烧 / 持续掉血 / 死亡自爆
- **边界**：
  - 街机 CD 未耗尽时不该扣血
  - 霹雳舞空踢不该扣血
  - 麦克已死亡时不重复结算
  - 章鱼投两次扣两次（非自杀型）
  - 焚烧在火把熄灭、`dt = 0` 时都不结算
  - 弄臣未旋转时不掉血
  - **自爆同一只僵尸只炸一次**（三个死亡入口去重）
  - 范围外植物不受影响
- **降级**：拿不到 `Rectangle` 走距离近似；缺 `ZombieDamageDetails` / `plantPool` 时不炸但写日志
- **异常安全**：依赖全缺时 8 种模式都不抛异常
- **宿主兜底**：只有 `log` / `ui` 的残缺 ctx，`startup + setup` 不抛

## 校验发布产物

`tools/pack.ps1` 打完之后会自动解包，并用包里的 `scripts/main.js`
重跑同一套断言（通过 `JBTMG_PKG_ROOT` / `JBTMG_ENTRY` 两个环境变量指过去）。
手动跑等价于：

```bash
JBTMG_PKG_ROOT=/path/to/unpacked JBTMG_ENTRY=/path/to/unpacked/scripts/main.js node tests/run.mjs
```

> 解包目录没有 `package.json`，`.js` 会被 node 当成 CommonJS。
> 要么在解包目录补一个 `{"type":"module"}`，要么把入口复制成 `.mjs`。
> `tools/pack.ps1` 走的是前者。
