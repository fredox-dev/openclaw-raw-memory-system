# OpenClaw Raw Memory System

OpenClaw 原始记忆库系统 - 自动备份 + 检索工具

## 功能

- **自动备份**：Gateway 启动时自动备份所有 agent 的原始对话
- **按天存储**：一天一个 markdown 文件，人类可读
- **检索工具**：Agent 发现记忆缺失时可搜索原始对话
- **零 Token 消耗**：备份过程不调用 LLM
- **跨平台**：支持 Windows、macOS、Linux

## 组件

| 组件 | 类型 | 功能 |
|------|------|------|
| `hook/` | Hook Pack | 自动备份原始对话 |
| `skill/` | Skill | 检索原始对话记忆 |

## 安装

### 安装 Hook（自动备份）

```bash
# 从本地安装
openclaw plugins install ./openclaw-raw-memory

# 或从 npm 安装（如果发布）
openclaw plugins install openclaw-raw-memory
```

### 安装 Skill（检索工具）

```bash
# 从本地安装
openclaw skills install ./openclaw-raw-memory/skill

# 或从 npm 安装（如果发布）
openclaw skills install openclaw-raw-memory-search
```

## 配置

### 环境变量配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `RAW_MEMORY_BACKUP_PATH` | 备份文件存储路径 | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | 轮询间隔（毫秒） | `600000`（10分钟） |
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace 根目录 | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | agents 目录路径 | `~/.openclaw/agents` |
| `AGENT_WORKSPACES` | agent workspace 映射 | 自动检测 |

### 在 openclaw.json 中配置

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/path/to/backup",
            "RAW_MEMORY_POLL_INTERVAL": 600000
          }
        }
      }
    }
  }
}
```

## 使用

### 自动备份

安装后，Gateway 启动时会自动启动备份守护进程：
- 每 10 分钟轮询所有 agent 的 JSONL 文件
- 有新内容时按天追加到 markdown 文件
- Gateway 关闭时自动停止

### 检索工具

Agent 发现记忆缺失时，执行：

```bash
node raw-tools.js search --agent <agentId> --query "关键词" --limit 3
```

返回格式：**前3句 + 目标句 + 后3句 = 7句话完整语境**

## 备份目录结构

```
<backupPath>/
├── loli/
│   ├── 2026-07-06.md
│   └── ...
├── main/
│   ├── 2026-07-06.md
│   └── ...
├── miya/
├── yuki/
└── lisa/
```

## 文件说明

### Hook 文件

- `HOOK.md` - Hook 元数据
- `handler.ts` - Gateway 启停逻辑
- `watcher.js` - 备份守护进程

### Skill 文件

- `SKILL.md` - 工具说明（agent 读取后知道怎么用）
- `raw-tools.js` - 检索脚本

## 依赖

- Node.js（内置，无需额外安装）
- OpenClaw Gateway

## 许可证

MIT License

## 作者

Loli（专属代码工程师）
