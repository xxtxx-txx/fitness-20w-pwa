# Fitness 20W PWA v0.1 — 实现与验收报告

## 状态

**已部署到 GitHub Pages，并在真实 Chrome 152 上实际执行通过 21 项原生浏览器检查。实体手机安装与飞行模式重开仍未实测，不能标记整个 AWC 为 DONE。**

工程：`fitness-20w-pwa/`。无后端、无登录、无云服务或远程 API。运行使用静态 HTML、CSS、ES module JavaScript。

已完成 44 项 Node 检查、9 项隔离 UI 检查。此前被托管浏览器策略阻塞的 21 项原生浏览器场景，已在本机 Chrome 上全部实际执行并通过，包含服务器停止 + 浏览器进程重启后的离线重开。

## 测试环境与证据边界

Node 22.16.0，Python 3.13.5，Playwright 1.57.0。UI 以 320、360、390、412、768、1280 CSS 像素宽度检查今天、本周和设置；并检查首次设置窄屏。触控按钮与动作详情入口至少 44px 高，未检测到页面横向溢出。390px 与 320px 的实际渲染截图已经过目视检查。

UI 在 `about:blank` 中使用真实应用渲染与交互代码，**本地存储由内存替身提供**。它验证界面、数据呈现与事件处理，不验证原生持久化、HTTP 模块加载、Service Worker 或安装。

Service Worker 单测使用 Cache Storage 和生命周期事件替身，验证预缓存列表、缓存读取分支、作用域隔离和升级触发逻辑；它同样不等于离线浏览器实测。

静态服务器已真实启动，并通过 Node HTTP 请求测试根路径、`/fitness/` 子路径、JS MIME、Manifest、图标和应用壳资源。Manifest JSON、图标尺寸及相对路径静态检查通过。

本机 Chrome 可用后，`tests/browser_smoke.py` 已在真实 Chrome 152 上完整执行：21/21 通过，应用以 `/fitness/` 子路径提供，含离线重开（静态服务器已停止、浏览器进程重启）。此前的环境阻塞记录保留为历史记录，不再代表当前状态。早先的 3 处失败均来自测试夹具假设而非应用缺陷——Playwright 的隐身上下文会报告 `in-incognito` 安装错误，`page.clock` 会抹掉 `performance.getEntriesByType('navigation')`——已仅在 `tests/browser_smoke.py` 内修正，应用代码未改。

证据：

- `unit-tests.txt`：44/44。
- `preview-results/results.json`：9/9，明确标注内存替身与 NOT_TESTED 的原生项目。
- `preview-results/*.png`：实际 UI 渲染截图，不是效果图。
- `browser-results/blocked-e2e-attempt.json`：21 个环境阻塞场景。
- `browser-results/results.json`：21 项真实 Chrome 检查（本地 `/fitness/` 子路径）。
- `browser-results/*.png`：真实 Chrome 渲染截图，含服务器停止 + 浏览器重启后的 `offline-restart-390.png`。
- `browser-results/live-verification.json`：线上地址的文件哈希、Manifest、Service Worker、installability 与离线复测结果。
- `../tests/browser_smoke.py`：可复跑的完整浏览器验收脚本。

## 原始验收项目映射

| 项目 | 结果 | 证据 / 边界 |
|---|---|---|
| AT-01 安装资格 | 通过（自动化） | 线上 Manifest 无错误、`display: standalone`、图标 192/512/512；真实 Chrome `Page.getInstallabilityErrors` 返回空列表。实体手机安装仍待人工验收。 |
| AT-02 独立窗口 | 待人工验收 | 已设 `display: standalone`；主屏图标启动独立窗口未实测。 |
| AT-03 默认本地 Today | 通过（自动化） | 本地自然日模型与隔离 UI 验证；UTC+8 跨日恢复。 |
| AT-04 Week 1–20 | 通过（自动化） | 第 1 / 7 / 8 / 134 / 140 天、非周一开始、闰日、夏令时相关日期。 |
| AT-05 周一 | 通过（自动化） | 力量 A；生米 200g，100g + 100g。 |
| AT-06 周二 | 通过（自动化） | Zone 2；生米 170g，85g + 85g。 |
| AT-07 周三 | 通过（自动化） | 力量 B；生米 200g；硬拉不变成 MRT。 |
| AT-08 周四 | 通过（自动化） | 恢复日；生米 140g，70g + 70g。 |
| AT-09 周五 | 通过（自动化） | 力量 C；生米 200g。 |
| AT-10 周六动态 | 通过（自动化） | W1–4、W5–16 可选 MRT、W17–18、W19、W20 的边界。 |
| AT-11 周日 | 通过（自动化） | 完全恢复；生米 140g。 |
| AT-12 早餐 | 通过（自动化） | 每天恰为 3 个鸡蛋、60g 燕麦、250ml 牛奶。 |
| AT-13 午餐蛋白 | 通过（自动化） | 每天 400g 生鸡胸肉。 |
| AT-14 晚餐蛋白 | 通过（自动化） | 每天 220g 生去皮去骨鸡腿肉。 |
| AT-15 离线打开 | 通过（自动化） | 线上真实 Chrome：断网重载渲染一致，内容来自本作用域缓存；静态服务器停止 + 浏览器进程重启后仍可离线打开。实体手机飞行模式待人工验收。 |
| AT-16 持久化 | 通过（自动化） | 线上真实 Chrome：离线重开保留完成记录，离线撤销 / 再次完成后重载仍保留。已安装 App / 实体手机重启待人工验收。 |
| AT-17 无后端依赖 | 通过（静态 / 逻辑） | 核心文件无远程 URL、CDN、API 或云依赖；静态资源可完整提供。 |
| AT-18 移动布局 | 通过（隔离 UI） | 320–1280px，无横向溢出；目视检查手机版。实体手机触感仍待使用确认。 |
| AT-19 周期边界 | 通过（自动化） | 第 141 天为 Cycle Complete，week=null，保留历史，不自动重启。 |

合计：**18 项自动化验证通过（44 项 Node + 21 项真实 Chrome）；1 项待人工验收（AT-02 独立窗口）。实体手机安装与飞行模式重开不在自动化范围内。**

“3 秒内理解今天全部安排”属于真实使用验收，本次没有把开发机渲染速度或截图可见性冒充用户理解耗时。

## 实现边界

不自动设置真实开始日期；第一次由使用者选择。演示截图中的日期与打勾均为测试数据，不是已经开始的真实训练周期。

减量周没有擅自生成具体减量组数，明确显示常规参考。Week 9–12 的可选 Top Set / Back-off 没有强制执行。Week 20 显示评估与恢复。主食继续是生米，没有未来扩展的假按钮。

导入先校验再确认；清空与撤销都有确认。版本升级和本地完成记录分开管理。原生升级、安装和离线行为须继续实测。

## 部署状态

已部署。独立仓库 `xxtxx-txx/fitness-20w-pwa`（不含任何其他项目），GitHub Pages 使用 `main` 分支 / 根目录发布：

```text
https://xxtxx-txx.github.io/fitness-20w-pwa/
```

应用文件（`index.html`、JS、CSS、Manifest、`sw.js`、`icons/`）自提交 `c1fc0a850b5aa424da6b4853b785aa73744bc417` 起字节未变；线上文件经 SHA-256 与该提交逐一比对一致。Service Worker 作用域为 `https://xxtxx-txx.github.io/fitness-20w-pwa/`，缓存键为 `fitness-20w:https://xxtxx-txx.github.io/fitness-20w-pwa/:0.1.0`，仅作用于本应用子路径。仓库公开状态经使用者明确授权后设为 public。

## 剩余人工动作

在实体手机上打开上面的地址，首次设置开始日期，等待“离线已就绪”后安装到主屏，从桌面图标启动确认独立窗口，并完成一次飞行模式关闭 / 重开检查。只有这些实际通过后，才关闭 AT-02 与实体机安装 / 离线 / 持久化验收并标记最终 DONE。
