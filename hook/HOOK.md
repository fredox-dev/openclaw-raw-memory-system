---
name: raw-backup
description: "自动备份所有 agent 的 JSONL 对话到安全位置（零 token 消耗）"
metadata:
  { "openclaw": { "emoji": "💾", "events": ["gateway:startup", "gateway:shutdown"], "requires": { "bins": ["node"] } } }
---

# Raw Backup Hook

Gateway 启动时自动启动备份守护进程，监控所有 agent 的 JSONL 文件变化，增量备份到安全位置。

## 配置

通过环境变量配置（可在 `openclaw.json` 的 `hooks.internal.entries.raw-backup.config` 中设置）：

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `RAW_MEMORY_BACKUP_PATH` | 备份文件存储路径 | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | 轮询间隔（毫秒） | `600000`（10分钟） |

## 目录结构

备份文件按 agent 和日期组织：

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

## 特性

- 零 token 消耗（纯文件复制）
- 不依赖 agent
- 不依赖 cron
- 随 Gateway 启停自动运行
- 按天存储，人类可读的 markdown 格式
