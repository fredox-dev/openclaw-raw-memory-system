# OpenClaw Raw Memory System

OpenClaw 原始记忆库系统 - 自动备份 + 检索工具

---

# English

## Features

- **Auto Backup**: Automatically backup all agent conversations when Gateway starts
- **Daily Storage**: One markdown file per day, human-readable
- **Search Tool**: Agents can search raw conversations when memory is missing
- **Zero Token Cost**: Backup process never calls LLM
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Components

| Component | Type | Function |
|-----------|------|----------|
| `hook/` | Hook Pack | Auto backup raw conversations |
| `skill/` | Skill | Search raw conversation memory |

## Installation

### Install Hook (Auto Backup)

```bash
# From local
openclaw plugins install ./openclaw-raw-memory

# From GitHub
openclaw plugins install https://github.com/oceanwh/openclaw-memory-system
```

### Install Skill (Search Tool)

```bash
# From local
openclaw skills install ./openclaw-raw-memory/skill

# From GitHub
openclaw skills install https://github.com/oceanwh/openclaw-memory-system/skill
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup file storage path | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Poll interval (ms) | `600000` (10 minutes) |
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace root | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Agents directory path | `~/.openclaw/agents` |
| `AGENT_WORKSPACES` | Agent workspace mapping | Auto-detect |

### Configure in openclaw.json

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

## Usage

### Auto Backup

After installation, the backup daemon starts automatically when Gateway starts:
- Polls all agent JSONL files every 10 minutes
- Appends new content to daily markdown files
- Stops automatically when Gateway shuts down

### Search Tool

When an agent discovers missing memory, execute:

```bash
node raw-tools.js search --agent <agentId> --query "keyword" --limit 3
```

Returns: **3 sentences before + target sentence + 3 sentences after = 7 sentences of context**

## Backup Directory Structure

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

## License

MIT License

---

# 中文

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

# 从 GitHub 安装
openclaw plugins install https://github.com/oceanwh/openclaw-memory-system
```

### 安装 Skill（检索工具）

```bash
# 从本地安装
openclaw skills install ./openclaw-raw-memory/skill

# 从 GitHub 安装
openclaw skills install https://github.com/oceanwh/openclaw-memory-system/skill
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

## 许可证

MIT License
