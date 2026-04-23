# Cursor Langfuse 集成

这是一个 Cursor Hooks 集成，用于将追踪数据发送到 Langfuse，以便对 AI 编码会话进行可观测性分析和调试。

## 圣诞贺卡

你可能会注意到仓库里有 `xmas.js` 和 `xmas.html`。这些当然是我们用来验证 Langfuse 集成是否正常工作的、极其严肃且至关重要的测试产物。

没有什么比一个交互式圣诞贺卡更能体现“production-ready observability tooling”了：飘落的雪花、可拖拽的礼物、可以摇晃的圣诞树、飞行中的圣诞老人，以及通过 Web Audio API 播放的《Jingle Bells》。

它确实起作用了。追踪数据看起来非常棒。节日快乐。

## 概览

这个项目可以将 Cursor AI 代理的活动自动追踪到 Langfuse。每一次提示词、响应、文件编辑、Shell 命令以及 MCP 工具调用，都会被捕获并发送到 Langfuse 进行分析。

## 功能特性

- **完整 Hook 覆盖**：支持全部 12 个 Cursor Hook（Agent 和 Tab 两种模式）
- **会话追踪**：按 `conversation_id` 对追踪进行分组，完整呈现整个会话
- **工作区会话**：按工作区对会话分组，便于筛选
- **动态标签**：根据活动类型自动打标签（shell、mcp、file-ops、thinking 等）
- **完成度评分**：跟踪代理的完成状态与效率指标
- **丰富元数据**：记录编辑统计、耗时、文件类型等信息
- **非阻塞**：发生错误时会记录日志，但不会中断 Cursor 的操作

## 支持的 Hooks

| Hook | 说明 |
|------|------|
| `beforeSubmitPrompt` | 捕获用户提示词和附件 |
| `afterAgentResponse` | 记录代理响应 |
| `afterAgentThought` | 记录代理的思考/推理过程 |
| `beforeShellExecution` | 在执行前跟踪 Shell 命令 |
| `afterShellExecution` | 捕获 Shell 命令输出 |
| `beforeMCPExecution` | 记录 MCP 工具调用 |
| `afterMCPExecution` | 记录 MCP 工具结果 |
| `beforeReadFile` | 跟踪文件读取操作 |
| `afterFileEdit` | 捕获文件编辑及其行数统计 |
| `stop` | 记录会话完成情况及状态评分 |
| `beforeTabFileRead` | Tab 模式下的文件读取 |
| `afterTabFileEdit` | Tab 模式下的文件编辑 |

## 安装

1. 将此仓库克隆或复制到你的项目目录中。

2. 安装依赖：

```bash
cd .cursor/hooks
npm install
```

3. 在项目根目录创建一个 `.env` 文件，并填入你的 Langfuse 凭据：

```env
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

4. Hook 配置文件（`.cursor/hooks.json`）已经设置好，会将所有 Hook 路由到该处理器。

## 配置

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANGFUSE_SECRET_KEY` | 是 | 你的 Langfuse Secret Key |
| `LANGFUSE_PUBLIC_KEY` | 是 | 你的 Langfuse Public Key |
| `LANGFUSE_BASE_URL` | 否 | Langfuse API 地址（默认为 `https://cloud.langfuse.com`） |

### Hooks 配置

`.cursor/hooks.json` 文件会为所有支持的事件注册 Hook 处理器：

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [{ "command": "node .cursor/hooks/hook-handler.js" }],
    "afterAgentResponse": [{ "command": "node .cursor/hooks/hook-handler.js" }],
    ...
  }
}
```

## 工作原理

1. Cursor 触发某个 Hook 事件，并通过标准输入传入 JSON 数据
2. Hook 处理器读取并解析输入内容
3. 使用 `conversation_id` 创建或更新 Langfuse trace
4. 相应的处理器处理该事件，并创建 spans / generations
5. 根据活动内容应用评分和标签
6. 在处理器退出前，将事件刷新到 Langfuse

### Trace 结构

- **Trace**：每个对话对应一个，由 `conversation_id` 标识
- **Session**：按工作区文件夹名称分组
- **Generations**：用户提示词与代理响应
- **Spans**：文件操作、Shell 命令、MCP 调用、思考过程
- **Events**：会话完成标记
- **Scores**：完成状态（0-1）与效率指标

### 自动标签

Trace 会根据活动类型自动打上标签：

- `cursor` - 所有追踪
- `agent` 或 `tab` - 依据 Hook 来源
- `shell` - Shell 命令活动
- `mcp` - MCP 工具使用
- `file-ops` - 文件读写操作
- `thinking` - 捕获到的代理推理过程
- 模型名称（例如 `claude-3-5-sonnet`）
- `status-completed`、`status-aborted`、`status-error`

## 项目结构

```
.cursor/
  hooks.json              # Cursor Hooks 配置
  hooks/
    hook-handler.js       # 主入口
    package.json          # 依赖项
    lib/
      langfuse-client.js  # Langfuse SDK 封装
      handlers.js         # 各 Hook 对应的处理器
      utils.js            # 工具函数
```

## 查看追踪

1. 登录你的 Langfuse 控制台
2. 进入 Traces 页面
3. 按会话（工作区名称）或标签进行筛选
4. 点击某个 trace，即可查看包含所有 spans 的完整对话

## 故障排查

### Langfuse 中没有显示 Trace

- 确认项目根目录下存在 `.env` 文件
- 检查 `LANGFUSE_SECRET_KEY` 和 `LANGFUSE_PUBLIC_KEY` 是否配置正确
- 查看 Cursor 开发者控制台中的错误信息

### Cursor 中出现 Hook 错误

该处理器被设计为可优雅失败。如果发生错误：
- 错误会被记录到 stderr
- 会返回一个宽松响应（`{ "continue": true, "permission": "allow" }`）
- 不会阻塞 Cursor 的正常操作

## 许可证

MIT
