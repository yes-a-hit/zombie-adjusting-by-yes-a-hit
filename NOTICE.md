# 声明 / NOTICE

本文件说明本仓库中非代码内容（游戏数据标识符、引擎笔记引用、商标）的来源与归属。

`LICENSE` 只放标准 MIT 全文；一切附加说明都放这里，
避免把「许可授予」和「额外声明」混在同一个文件里造成歧义。

---

## 1. 代码与文档

`scripts/`、`jsons/`、`tests/`、`tools/`、`docs/` 及各类 Markdown 文档由 YG 编写，
以 [`LICENSE`](LICENSE) 中的 MIT 条款授权。

本仓库不含任何第三方模组代码，也不含任何音频、美术等素材文件——
模组只通过数据补丁与运行期钩子改变原版行为。

## 2. 游戏数据标识符

`jsons/objects/ZombieProps.json` 中出现的 `egypt_imp`、`future_imp` 等 codename，
以及 `Toughness` 等字段名，是《植物大战僵尸 2》及其衍生项目 **PvZ2 Gardendless**
的数据标识符，仅用于与该软件互操作。这些标识符属于接口约定，
不构成本项目对游戏内容的复制。

`scripts/main.js` 中出现的引擎类名（`EightiesGargantuarZombie` 等）、
方法名与事件名同理。

**本仓库不包含任何游戏本体资源**（美术、音频、关卡、文本等）。
运行本模组需要玩家自行拥有 PvZ2 Gardendless。

## 3. 引擎笔记的来源

[`docs/ENGINE-NOTES.md`](docs/ENGINE-NOTES.md) 是对 PvZ2 Gardendless 运行期行为的
**互操作性观察笔记**，用于让本模组正确地与目标软件配合，不复制其源代码。

笔记中摘录的少量标识符与实现片段，是为说明互操作所必需的**最小引用**，
版权归原项目 `Gzh0821/pvzge_web` 及其权利人所有。本仓库不分发该项目的任何文件。

## 4. 商标

「植物大战僵尸」「Plants vs. Zombies」及相关名称、标识是其各自权利人的商标。
本项目为个人爱好者作品，与上述权利人无任何关联，也未获得其背书。
