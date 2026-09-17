# Fitness · 20W PWA v0.1

手机优先的训练与饮食执行面板。打开默认进入今天；不登录、不接入后端、不请求远程 API。

**当前交付：已部署到 GitHub Pages；44 项 Node 检查、9 项隔离界面检查和 21 项真实 Chrome 浏览器检查通过（含浏览器进程重启后的离线重开与持久化）。实体手机安装、主屏图标独立窗口与飞行模式重开仍待人工验收，不能宣称全部 DoD 已完成。** 详见 `docs/ACCEPTANCE.md`。

## 本地运行

在工程目录运行，不需要安装 npm 依赖：

```sh
npm start
```

浏览器访问：

```text
http://127.0.0.1:8000/
```

没有 Node 时，用 Python 的静态服务器也可以：

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Windows 中也可将上面的 `python` 替换为 `py`。不要直接双击 `index.html`：ES module 和 PWA 离线能力需要通过合适的站点环境加载，而不是 `file://`。

本地服务器只负责送出静态文件，不是业务后端；部署后无需常驻自己的电脑或服务器。

## 部署到 GitHub Pages

已上线：`https://xxtxx-txx.github.io/fitness-20w-pwa/`（独立仓库 `xxtxx-txx/fitness-20w-pwa`，`main` 分支 / 根目录）。线上应用文件经 SHA-256 与仓库提交逐一比对一致。

更新时保留根目录中的 `index.html`、`sw.js`、`manifest.webmanifest`、所有 JS / CSS 和 `icons/`，提交到 `main` 后 Pages 会自动重建。对应的仓库设置：

```text
Settings → Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)
Save
```

等待 GitHub Pages 发布成功，再使用它提供的 HTTPS 地址。仓库子路径受支持，所有核心资源、Manifest、Service Worker 的路径都是相对于应用目录。本仓库的公开状态来自使用者的明确授权；免费计划下改回私有会使 Pages 下线，必须重新获得确认。

也可以只生成和上传发布文件：

```sh
npm run build
```

产物在 `dist/`，不含测试、预览截图和开发文档。随交付提供的 `fitness-20w-pwa-static-v0.1.0.zip` 内容等同于该目录；解压后让 `index.html` 位于站点或仓库发布目录根部。

不需要 SPA rewrite；导航是页面内部状态，不使用会导致 Pages 刷新 404 的前端路由。

## 手机安装与离线验收

在手机浏览器打开已发布的 HTTPS 地址，首次只设置开始日期。等右上角显示 **“离线已就绪”**，然后使用浏览器原生的“安装应用 / 添加到主屏幕”。iOS 使用 Safari 的分享菜单添加到主屏幕。

安装后从主屏图标启动，确认当前浏览器支持独立窗口。仅创建一个仍在浏览器中打开的快捷方式，不算 AT-02 通过。

完成一次今日打勾，然后关闭页面和已安装应用。开启飞行模式，从主屏图标重新打开：今天的训练、三餐以及刚才的完成记录都应保留；离线撤销 / 再次完成后，重开也应保留。首次从未联网加载过时，不承诺能离线安装或打开。

浏览器安装要求及支持情况会随平台变化。官方参考：

```text
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
https://web.dev/learn/pwa/service-workers
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
```

## 执行规则

训练按设备的真实本地星期安排；计划周以开始日期为锚，每七天一周。周三开始不会被改成周一，也不会要求补练。周计划按周一到周日排列，因此一行日历周可能跨两个计划周。手动预览不改变真正的今天；未来日期不能提前打勾。

第 140 天是 Week 20 的最后一天。第 141 天显示 `Cycle Complete`，不自动重启，保留原有日期记录。更改开始日期需要确认，只重算周次，不迁移或删除完成记录。

饮食固定为早餐 3 个鸡蛋、60g 燕麦、250ml 牛奶；午餐 400g 生鸡胸肉；晚餐 220g 生去皮去骨鸡腿肉。力量日生米 100g + 100g，体能日 85g + 85g，恢复日 70g + 70g。牛奶品牌不阻塞设置，不计算未经确认的宏量营养总计。

减量周会明确提示；AWC 未指定逐动作减量组数，程序不会擅自生成。此时显示“常规参考”，不把常规组数当作本周目标。Week 19 同样显示总量减少约 40%，不武断地为每个动作四舍五入组数。

Week 9–12 的 Top Set + Back-off 是可选进阶，保留基础处方并在训练说明中提示；没有自动切换。Week 13–16 的较重后蹲 / 卧推按 AWC 的 4–6 次侧重执行，周五容量课保留原处方。Week 20 是评估与恢复，不要求 1RM。

周六默认 Zone 2；只有 Week 5–16 可手动选 MRT，并按日期保存选择。硬拉不进入 MRT。没有自动替换土豆、红薯、虾仁，也没有 Minimum Mode、体测或学习模块的未完成 UI。

## 数据与备份

使用按应用路径隔离的 `localStorage`，schemaVersion 为 1；无账号、无云同步、无后台采集。备份包含开始日期、基准体重、完成记录、周六选择和预留扩展数据。

设置中可以导出 / 导入 JSON。导入先验证版本、类型、日期、食物配置和大小，再请求确认；无效数据或取消不会覆盖现有记录。已有数据损坏时保留原始内容，显示恢复页面，不静默当成首次启动。保存失败会报错，不会假装打勾已保存。

清理站点数据、隐私模式、存储被浏览器回收、换设备、换域名或更改站点路径都可能使原记录不可见。**换设备、换发布地址或清理浏览器之前，先导出备份。** 不要把实际导出的个人备份提交到公开仓库。

## 测试

纯逻辑、静态资源、静态服务器和 Service Worker 事件逻辑检查：

```sh
npm test
```

真实浏览器测试（开发依赖；不属于运行应用所需依赖）：

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser_smoke.py
```

也可显式指定可用的 Chromium：

```sh
python tests/browser_smoke.py --chromium /path/to/chromium
```

浏览器脚本在临时项目副本的 `/fitness/` 子路径运行，不改动源码；包含 Manifest 诊断、离线重开、浏览器进程重启、备份恢复、缓存升级与故障注入。

`tests/render_preview.py` 是受限环境中的**隔离 UI 预览**：使用真实应用 JS/CSS 和内存存储替身，在 `about:blank` 内渲染。它不证明原生 localStorage、Service Worker、安装或离线能力。当前预览截图右上角的“离线未就绪”来自此预览环境，不伪装为原生离线验收结果。

## 关键文件

```text
index.html             应用壳、Manifest 和系统元信息
app.js                 今天 / 本周 / 设置、交互与离线状态
program.js             结构化训练、饮食和阶段规则
date-engine.js        本地自然日、计划周、日历周与边界
state.js               schema 验证、本地存储、JSON 备份
styles.css             移动端布局、中文排版、可访问性
manifest.webmanifest   应用名称、图标、启动地址和作用域
sw.js                  版本化、作用域隔离的离线缓存
icons/                 192 / 512 / maskable / Apple touch 图标
tests/                 自动化检查与真实浏览器验收脚本
tools/                 静态预览服务器、纯文件复制构建
HANDOFF.md             Codex / 豆包的剩余执行交接
```

## 更新版本

每次修改发布资源，更新 `program.js` 的 `APP_VERSION`、`sw.js` 的 `RELEASE` 和 `package.json` 版本，并完整部署同一发布目录。Service Worker 先缓存整套新文件；旧版本打开期间不会被静默替换。新版本准备好后可点“更新并重载”，完成记录不随缓存清理删除。缓存清理只作用于当前应用路径，不清理同域其他 PWA 的缓存。

原生更新生命周期仍需要真实浏览器验收。不要将单元测试中的 Cache Storage 替身误写成浏览器实测。
