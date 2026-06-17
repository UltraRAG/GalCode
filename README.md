# GalCode

GalCode 是一个 macOS-first 的 galgame 风格 code-agent 桌面壳。它把本机常用的代码智能体 CLI，例如 Codex、Claude Code、Cursor Agent，包装成可切换的 galgame 角色：你在对白框里输入任务，GalCode 会把任务转发给对应 CLI，并把模型输出渲染成角色对白。

当前版本是 v0.1 MVP，目标是先跑通“像视觉小说一样和本地 code agent 对话”的核心闭环。

## 当前能力

- Electron + React 桌面应用。
- 默认三位 agent 角色：Codex、Claude Code、Cursor Agent。
- galgame 首屏：背景、立绘、姓名牌、底部对白框、右上角轻量菜单。
- 对白框固定在底部，历史消息在框内滚动，不会遮住整屏。
- One-shot/headless agent 调用，适合 Codex、Claude Code、Cursor Agent 的 CLI 输出模式。
- `/login` 特殊命令：在 macOS Terminal 中打开当前 agent 的原生登录流程。
- 本地 workspace 选择。
- 自定义 agent 增删改。
- 本地主题目录导入，自动绑定背景和角色立绘。
- `galcode-asset://` 协议加载本机图片素材。
- Raw Log 面板保留原始 CLI 输出。
- 当前会话 Markdown 导出。
- 内置 Echo Agent，用于无账号时测试管线。
- Agent 健康检查脚本，一条命令验证 Codex/Claude/Cursor 是否可用。

## 快速开始

```bash
npm install
npm run start:desktop
```

开发模式：

```bash
npm run dev
```

只看前端预览：

```bash
npm run dev:web
```

浏览器预览不能启动本地 CLI，也不能显示 `galcode-asset://` 本地图片。真实使用请启动 Electron 桌面应用。

## Agent 登录

GalCode 调用的是你本机已经安装并登录过的 CLI。第一次使用时，先在 GalCode 对应角色里输入：

```text
/login
```

GalCode 会打开 macOS Terminal，并运行对应登录命令：

| Agent | 登录命令 | 默认调用方式 |
| --- | --- | --- |
| Codex | `codex login` | `codex exec --json --color never --skip-git-repo-check "{prompt}"` |
| Claude Code | `claude auth login` | `claude -p --output-format text "{prompt}"` |
| Cursor Agent | `cursor-agent login` | `cursor-agent --print --output-format text --trust "{prompt}"` |

也可以手动在终端执行登录命令。登录后运行：

```bash
npm run test:agents
```

期望看到 Codex、Claude Code、Cursor Agent 都返回各自的 `GC_*_OK`。

## 常用命令

```bash
npm run build
npm run doctor
npm run test:smoke
npm run test:runtime
npm run test:agents
npm audit --audit-level=critical
```

`test:agents` 会真正调用三家 CLI。如果某个账号没有登录，这个检查会失败，这是预期行为。

## 本地主题目录

默认会加载 `sample-assets/` 作为本地测试素材。你可以在 Settings 中点击 `Import Theme Folder` 导入自己的主题包。

推荐目录结构：

```text
my-theme/
  backgrounds/
    room-evening.png
  characters/
    codex-koharu.png
    claude-shiori.png
    cursor-akari.png
```

文件名包含以下关键词会更容易被自动绑定：

```text
background, bg, scene, room, codex, claude, cursor,
portrait, sprite, standing, tachie, character name
```

当前示例素材的来源和授权见：

- `sample-assets/CREDITS.md`
- `docs/asset-sources.md`

## Echo Agent

如果你还没有登录任何真实 code agent，可以用 Echo Agent 测试 GalCode 的本地调用链。

在 Settings 里点击 `Use Echo Test Agent`，或手动配置：

```text
command: node
args: scripts/echo-agent.mjs "{prompt}"
mode: oneshot
```

## 项目结构

```text
electron/
  main.cjs              Electron 主进程、IPC、CLI 启动、登录桥
  preload.cjs           Renderer 安全桥
  agent-runtime.cjs     命令解析和素材扫描工具

src/
  App.tsx               主界面和交互逻辑
  core.ts               默认 agent、状态工具、导出工具
  styles.css            galgame UI 样式
  types.ts              类型定义

scripts/
  agent-health.ts       三家 CLI 端到端健康检查
  doctor.ts             本地环境检查
  echo-agent.mjs        Echo 测试 agent
  smoke-test.ts         前端核心逻辑 smoke test
  runtime-test.cjs      runtime 工具测试

sample-assets/          本地测试背景和立绘
docs/                   规划、验收、素材来源
themes/                 默认主题描述
reference-library/      参考资料索引和视觉笔记
```

## 设计方向

GalCode 的默认体验应该像一个 galgame，而不是一个后台管理台：

- 首屏优先展示背景、角色和对白。
- 设置、日志、角色切换收进右上角 Menu。
- 对话历史不允许撑开布局，只能在对白框内部滚动。
- 素材系统保持本地可替换，后续再做用户自定义角色包和图库管理。

## 素材和版权

仓库内只包含用于本地 MVP 测试的公开素材，并在 `sample-assets/CREDITS.md` 中记录来源。商业游戏素材、私有素材包、用户自行收集的参考图，不应该直接提交到仓库。后续可以通过本地主题目录导入。

## 当前限制

- 仅优先支持 macOS。
- Claude Code 和 Cursor Agent 必须完成各自 CLI 登录后才能使用。
- Live2D、语音、BGM、多角色并行对话、结构化 diff 展示还未实现。
- 当前角色立绘只是测试素材，不代表最终美术方向。

## 参考

- `docs/reference-strategy.md`
- `docs/acceptance-v0.1.md`
- Ren'Py: https://www.renpy.org/
- super-agent-party: https://github.com/heshengtao/super-agent-party
- Galcode Island: https://github.com/sjyinzju/Galcode_island
