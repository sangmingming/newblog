# AGENTS.md

码农明明桑的个人博客（Hugo 静态站），https://isming.me/。中文内容为主，主题为 vendored 的 `zen`。

## Setup commands

- 安装 Hugo（建议 latest，对齐 `.github/workflows/main.yml` 里的 `peaceiris/actions-hugo@v2`）
- 本地预览：`hugo server -D`（含 draft）
- 构建：`hugo -D`（输出到 `./public`）
- 部署：GitHub Actions **手动触发**（`.github/workflows/main.yml`，`workflow_dispatch`），推到 `gh-pages` 分支

> 没有 `package.json` / `go.mod`（仅 `themes/zen/` 自带一份模块声明），无 npm 依赖；主题是 vendored，不走 submodule。

## Project layout

- `config.toml` — Hugo 全站配置（菜单 / 主题参数 / 永久链接 / highlight 主题）
- `content/`
  - `posts/tech/`、`posts/photography/`、`posts/essay/` — 三大文章分类
  - `locations/` — 地图相关条目（每条对应一个地点）
  - `archives/`、`search/`、`about.md`、`links.md`、`_index.md`
- `archetypes/default.md` — 新建内容时的默认 frontmatter
- `data/book.csv`、`data/movie.csv` — 读书 / 观影数据
- `static/` — 静态资源（avatar、icons、resume、PWA manifest / service-worker、站点验证文件）
- `themes/zen/` — vendored 主题（直接在此改，不走 submodule）
- `_Templates/` — Obsidian + Templater 用的 frontmatter 模板
- `.github/workflows/main.yml` — 部署流水线

## Code style

- Hugo Markdown（goldmark），`unsafe = true`（允许 raw HTML）
- 语法高亮：`dracula`，`tabWidth = 2`，开启行号
- TOC：1–3 级，`ordered = false`
- CJK 内容：`hasCJKLanguage = true`，中文标点保持全角
- 永久链接：`/posts/:filename/`（文件名即 slug，不要带日期路径）
- Frontmatter 至少包含 `title` / `date` / `draft`；posts 加 `tags` / `comments` / `feature`
- 主题修改直接改 `themes/zen/` 内的文件；上游参考 `themes/zen/go.mod` 里的 `github.com/sangmingming/hugo-zen`

## Testing instructions

- 没有自动化测试（纯内容/主题仓库）
- 改完跑一次 `hugo server -D`，肉眼检查首页、对应分类、标签页、归档页、地图页都能正常渲染
- 新建 / 重命名文件后，确认旧 permalink 失效是否可接受（站点没有 redirect 配置）

## PR & commit conventions

- 从 `main` checkout 新分支；不要直接 push 到 `main`
- Commit message 沿用现有风格（混用前缀即可）：`feat:` / `fix:` / `article:` / 纯描述都行
- 一类改动一个 commit；图片和文章正文放同一个 commit 里
- 部署必须手动触发 `.github/workflows/main.yml`，**不要**启用 push 自动部署

## Security

- 文章内容遵循 CC BY-NC-SA 4.0，转载需署名
- 部署 token（`secrets.PERSONAL_TOKEN`）在 GitHub Secrets 里，agent 不要尝试读取或打印
- 不要在 `static/` 提交个人敏感文件（历史遗留如 `sangmingming_resume.doc` 是已知项，新内容注意脱敏）
