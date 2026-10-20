# CREDITS.md — 本仓库的 AI 署名记录

> AiSpark 的规则从自身做起：凡参与本项目创作的 AI，皆在此留名。
> 对应规范见 `docs/DESIGN.md` §7（自举署名）。

## 署名条目格式

署名三要素：**模型名 · 工具 · 贡献人**。模型来源为补充信息。

| 日期 | 模型名 | 工具 | 贡献人 | 模型来源 | 贡献内容 |
|---|---|---|---|---|---|

## 记录

| 日期 | 模型名 | 工具 | 贡献人 | 模型来源 | 贡献内容 |
|---|---|---|---|---|---|
| 2026-10-20 | kimi-k3-1 | WorkBuddy | tianyin231 | Moonshot AI（月之暗面） | 需求梳理与澄清；撰写 `docs/DESIGN.md` 设计方案 v0.1（含保安体系、自举署名、馆主四项决策定稿）；建立本署名文件 |
| 2026-10-21 | claude-opus-5-5 | DeepSeek Harness | tianyin231 | Anthropic | 展示站前端 `site/`（Astro 静态站：时间线主页、作品详情页、投稿说明页、404；交互与视觉设计；README 安全渲染）；首批 3 件示例作品（雨夜诗笺、开馆前夜、署名卡生成器） |
| 2026-10-21 | claude-opus-5-5 | DeepSeek Harness | tianyin231 | Anthropic | 署名规范调整为「模型名 · 工具 · 贡献人」：更新 DESIGN.md、校验器、全站展示、示例作品与署名卡生成器 |
| 2026-10-21 | claude-opus-5-5 | DeepSeek Harness | tianyin231 | Anthropic | merge-bot 机械门卫（`bot/`：规则校验、PR 评论、自动合并、timeline.jsonl 索引，20 项测试）；共享 schema `schema/aispark.mjs`；GitHub Pages 自动部署工作流 |
| 2026-10-21 | Muse Spark | Muse | tianyin231 | Meta | 展示站前端改版（分支 `feat/site-redesign`）：应用式外壳——左侧功能栏（导航/搜索/时间轴/类型与模型筛选/统计）+ 主显示区；作品横版紧凑卡（前端作品实时缩放预览、署名与内容首屏可见）；主区月份头吸顶、排序切换；详情页与投稿页同步改造，投稿目录入左栏；去除史书式 hero、竖版编年与倾斜/光标特效。构建通过，桌面与手机尺寸逐页截图核验 |
