# Raw Memory Search Skill

## 用途
当 Agent 发现记忆不完整或缺失时，搜索原始对话记忆。

## 配置

通过环境变量配置：

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace 根目录 | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | agents 目录路径 | `~/.openclaw/agents` |
| `AGENT_WORKSPACES` | agent workspace 映射 | 自动检测 |

### Agent Workspace 映射

工具会自动检测 agent workspace：
- 扫描 `~/.openclaw/workspace-*` 目录
- `workspace` 目录对应 `main` agent
- 其他 `workspace-<agentId>` 目录对应相应 agent

也可以通过环境变量手动指定：
```bash
AGENT_WORKSPACES="loli:workspace-loli,main:workspace,miya:workspace-miya"
```

## 安装后使用方法

### 第一步：发现记忆缺失
当你发现记忆不完整时，不要告诉主人你"失忆"了，直接执行搜索。

### 第二步：搜索原始记忆
```bash
node <skill-dir>/raw-tools.js search --agent <你的ID> --query "关键词" --limit 3
```

### 第三步：使用搜索结果
搜索结果格式：**前3句 + 目标句 + 后3句 = 7句话完整语境**

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--agent` | 搜索哪个 agent 的记忆 | 必填 |
| `--query` | 搜索关键词（支持多词 AND） | 必填 |
| `--limit` | 最多返回几条结果 | 3 |
| `--from` | 起始日期（YYYY-MM-DD） | 不限 |
| `--to` | 结束日期（YYYY-MM-DD） | 不限 |

## 示例

```bash
# 搜索关于"我爱你"的记忆
node raw-tools.js search --agent loli --query "我爱你" --limit 3

# 搜索特定日期范围
node raw-tools.js search --agent main --query "项目" --from 2026-07-01 --to 2026-07-06

# 搜索多个关键词（AND 逻辑）
node raw-tools.js search --agent miya --query "记忆 系统" --limit 5
```

## 搜索结果格式

```json
{
  "results": [
    {
      "timestamp": "06:05:33",
      "date": "2026-07-05",
      "snippet": "前3句...\n\n--- 目标句 ---\n\n后3句...",
      "source": "2026-07-05.md",
      "contextRange": "7 sentences"
    }
  ],
  "total": 3
}
```

## 记忆检索铁律

**当你发现记忆不完整或缺失时，必须执行以下流程：**

1. **先用现有记忆搜索**
   ```
   memory_search(query="关键词")
   ```

2. **如果不够，搜索原始对话**
   ```bash
   node raw-tools.js search --agent <你的ID> --query "关键词" --limit 3
   ```

3. **找到后继续工作，不要告诉主人你"失忆"了**

> ⚠️ 这是铁律。记忆缺失时必须主动检索，不能装作记得。

## 前置条件

需要已经安装 `openclaw-raw-memory` Hook Pack（提供自动备份功能）。

## 相关文件

- `raw-tools.js` - 检索脚本
- 备份位置：默认在 `~/.openclaw/raw-memory-backup/`（可通过 `RAW_MEMORY_BACKUP_PATH` 环境变量修改）
