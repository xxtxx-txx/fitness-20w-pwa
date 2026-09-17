# Codex / 豆包接手：Fitness 20W PWA v0.1

## Mission

接手这个已经实现的静态工程，完成部署和仍未通过的原生 PWA 验收。不重新做产品规划，不整套重写。

## Current State

核心 Today / Week / Settings、首次设置、自然日 / 周次计算、训练与饮食数据、打勾与撤销、JSON 备份、Manifest、图标和 Service Worker 已实现。

44 项 Node 检查、9 项隔离 UI 检查已通过。当前会话环境的 Chromium 被 `ERR_BLOCKED_BY_ADMINISTRATOR` 限制，额外测试浏览器下载因 DNS 失败，所以原生安装、独立窗口、离线重开、浏览器重启持久化没有实测通过。

不要把隔离 UI 的内存存储替身，或者 SW 单测的 Cache Storage 替身，当成原生验证证据。

## Authority / Non-negotiables

可修复加载、路径、缓存、兼容性和可访问性问题，并补测试。保留用户原始 AWC 的全部训练 / 饮食约束：鸡蛋 3 个，燕麦 60g，牛奶 250ml，生鸡胸 400g，生去皮去骨鸡腿 220g；生米日总量 200 / 170 / 140g。禁止变成熟饭重量，禁止自动替换主食，禁止增加后端、登录或 System A 集成。

减量周未指定的具体组数不自行发明。Week 20 后不自动重启。

## Execute

1. 解压到用户电脑上的独立工程目录，阅读 `README.md` 和 `docs/ACCEPTANCE.md`，运行 `npm test`。
2. 在可访问 localhost 的 Chromium 上运行 `python tests/browser_smoke.py`；修复实际发现的问题后复测。不要因为托管浏览器的环境封锁而删除应用的安全机制。
3. 以用户明确授权的 Fitness 仓库为发布目标，采用 README 的 GitHub Pages 分支发布方式。没有目标仓库时，请用户指定或授权新建；不覆盖留学工作台或其他项目，不擅自改变仓库公开状态。
4. 上线后核对 Manifest 与 SW 的实际 URL / scope。在真实手机安装，从桌面图标启动；飞行模式下关闭并重开，核对三餐、训练和已保存记录。由用户完成需要实体手机的步骤。
5. 更新验收报告，以真实证据关闭 AT-01 / AT-02 / AT-15 / AT-16。记录浏览器、平台、测试方式；做不到的仍列待验收。

## DoD

只有原始 AWC 的 19 项验收及所列 DoD 均有证据通过，才标记最终 DONE。当前是“实现交付，等待原生 PWA 验收”，不是全部完成。

## Return

只返回：最终部署地址、实际通过的测试、剩余问题和唯一必要的人工操作。不返回长篇产品重设计。
