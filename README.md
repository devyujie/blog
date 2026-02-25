# 0x5E Blog

一个基于 **Notion + Elog + Hexo + GitHub Actions + Vercel** 的个人博客仓库。
站点地址：[https://bianyujie.cn](https://bianyujie.cn)

## 1. 项目概览

本仓库的核心目标是把内容生产和网站构建彻底解耦：

- 在 Notion 写作和管理文章状态
- 用 Elog 将「已发布」内容同步为本地 Markdown
- 用 Hexo 生成静态站点
- 用 GitHub Actions 自动拉取、生成摘要并提交
- 用 Vercel 托管并提供 CDN 加速

## 2. 技术栈

- 内容源：Notion Database
- 同步工具：`@elog/cli`
- 静态站点生成：Hexo `7.3.0`
- 主题：`themes/brewski`（Pug + CSS）
- 自动化：GitHub Actions
- 部署：Vercel
- AI 摘要：智谱 AI `glm-4.7-flashx`

## 3. 目录结构

```text
.
├─ source/                     # Hexo 内容目录（文章、页面、图片、静态资源）
│  ├─ _posts/                  # Elog 同步后的 Markdown 文章
│  └─ images/                  # Elog 同步后的图片资源
├─ themes/brewski/             # 博客主题
├─ scripts/
│  └─ ai-summary-loader.js     # Hexo 渲染阶段注入摘要
├─ tools/
│  └─ generate-ai-summaries.cjs# 调智谱批量生成摘要并缓存
├─ docs/
│  └─ ai-summary-prompt.md     # 摘要提示词
├─ .github/workflows/
│  └─ sync.yaml                # 自动拉取 Notion + 生成摘要 + 提交
├─ ai-summaries.json           # 摘要缓存
├─ elog.config.js              # Elog 同步规则
├─ _config.yml                 # Hexo 主配置
└─ vercel.json                 # Vercel 头信息配置
```

## 4. 内容发布链路

```text
Notion(状态=已发布)
  -> Elog 同步到 source/_posts + source/images
  -> AI 摘要脚本生成/更新 ai-summaries.json
  -> Hexo 读取文章 + 摘要缓存，生成 public/
  -> Vercel 部署上线
```

## 5. 本地开发调试

### 5.1 环境要求

- Node.js 20.x（与 CI 保持一致）
- npm 10+

### 5.2 安装依赖

```bash
npm i
```

### 5.3 配置环境变量（本地）

在仓库根目录创建或维护 `.elog.env`（此文件不会被提交到远程仓库，可放心）：

```env
NOTION_TOKEN=your_notion_token
NOTION_DATABASE_ID=your_database_id
ZHIPU_AI_API_KEY=your_zhipu_key
```

必填项：

- `NOTION_TOKEN`：Notion 集成 Token
- `NOTION_DATABASE_ID`：Notion 数据库 ID
- `ZHIPU_AI_API_KEY`：智谱接口 Key（用于生成摘要）

可选项（AI 摘要）：

- `ZHIPU_AI_MODEL`：默认 `glm-4.7-flashx`
- `ZHIPU_AI_THINKING`：默认 `disabled`
- `ZHIPU_AI_MAX_INPUT_CHARS`：默认 `12000`
- `ZHIPU_AI_MAX_OUTPUT_TOKENS`：默认 `240`

### 5.4 运行

```bash
# 从 Notion 拉取文章到本地
npm run sync:local

# 启动本地预览
npm run server
```

### 5.5 命令解释

| 命令 | 作用 |
| --- | --- |
| `npm run server` | 清理并`启动本地预览` |
| `npm run sync:local` | 从 Notion 拉取文章到本地 |
| `npm run summary:generate` | 增量生成摘要（按哈希复用缓存） |
| `npm run summary:force` | 强制重算全部摘要（忽略缓存） |
| `npm run build` | 生成静态文件到 `public/` |
| `npm run clean` | 清理 Hexo 缓存与构建产物 |
| `npm run sync` | CI 使用的同步命令（不带 `.elog.env` 参数） |
| `npm run elog:clean` | 清空 Elog 同步内容 |

## 6. Elog 同步规则

`elog.config.js` 关键策略：

- 仅同步 `status = 已发布` 的 Notion 页面
- 输出到 `source/_posts`
- 文件名使用文章 `title`
- Front Matter 字段包含以下内容，每项说明如下：
  - `title`：文章标题
  - `date`：首次发布时间（ISO 格式）
  - `updated`：最近更新时间（ISO 格式，若无变更可等同于 `date`）
  - `permalink`：自定义永久链接，可用于指定文章访问路径
  - `tags`：文章标签列表（数组形式），用于分类
  - `ai`：是否由 AI 润色（布尔值）
  - `original`：是否为原创文章（布尔值）
- 图片导出到 `source/images`，并用 `/images` 前缀引用

## 7. AI 摘要系统

### 7.1 组成

- 提示词：`docs/ai-summary-prompt.md`
- 生成脚本：`tools/generate-ai-summaries.cjs`
- 缓存文件：`ai-summaries.json`
- 渲染注入：`scripts/ai-summary-loader.js`

### 7.2 机制

- 每篇文章会计算 `title + 正文文本` 的 SHA1 哈希
- 哈希不变时，`summary:generate` 直接复用缓存
- 文章变化时，只重算对应文章摘要
- 删除文章时，会清理缓存里的孤儿项
- 使用 `npm run summary:force` 时，会无视哈希，强制全量重算

### 7.3 渲染行为

- Hexo 在渲染前读取 `ai-summaries.json`
- 自动把摘要注入到文章对象 `ai_summary`
- 主题在文章标题下方渲染 `AI 摘要` 区块

## 8. GitHub Actions 自动化

工作流文件：`.github/workflows/sync.yaml`

触发方式：

- 定时自动触发：`cron: 0 0 * * *`（UTC，每天一次）
- 手动触发：`workflow_dispatch`（在 GitHub 仓库的 Actions 页面点击 "Run workflow" 按钮）

CI 所需的 GitHub Secrets（在仓库的 Settings -> Secrets and variables -> Actions 中添加，和 5.3 步骤中的参数一致）：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `ZHIPU_AI_API_KEY`

## 9. 常见问题

### Q1：摘要脚本提示未设置 `ZHIPU_AI_API_KEY`

- 确认你已经在 `.elog.env` 和 GitHub Secrets 中配置了 `ZHIPU_AI_API_KEY`

### Q2：为什么 `summary:generate` 没有新生成？

- 这是增量逻辑，哈希未变化会复用缓存
- 需要强制重算请使用 `npm run summary:force`

### Q3：Notion 文章没有同步下来

- 检查 Notion 页面状态是否为 `已发布`
- 检查 `.elog.env` 中 `NOTION_TOKEN` / `NOTION_DATABASE_ID` 是否正确

## 10. 注意事项

- 本地开发调试时，确保 `.elog.env` 文件存在且内容正确
- 线上部署时，确保 GitHub Secrets 中已添加对应变量（与 `.elog.env` 中的变量一致）
- Notion 文章中，状态确保为 `已发布`

---

基础模板来源：[`elog-x/notion-hexo`](https://github.com/elog-x/notion-hexo)
当前仓库在其基础上做了深度改造。
