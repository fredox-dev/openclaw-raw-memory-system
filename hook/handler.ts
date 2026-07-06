/**
 * raw-backup hook handler
 * 
 * Gateway 启动时启动备份守护进程
 * Gateway 关闭时停止备份守护进程
 */

import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

let backupProcess: ChildProcess | null = null;

const HANDLER_NAME = "[raw-backup]";

export default async function handler(event: any) {
  if (event.type === "gateway" && event.action === "startup") {
    // Gateway 启动 → 启动备份守护进程
    if (backupProcess) {
      console.log(`${HANDLER_NAME} Backup process already running`);
      return;
    }

    const watcherScript = join(homedir(), ".openclaw", "hooks", "raw-backup", "watcher.js");
    
    backupProcess = spawn("node", [watcherScript], {
      detached: true,
      stdio: "ignore",
    });

    backupProcess.unref();

    console.log(`${HANDLER_NAME} Backup watcher started (PID: ${backupProcess.pid})`);
  }

  if (event.type === "gateway" && event.action === "shutdown") {
    // Gateway 关闭 → 停止备份守护进程
    if (backupProcess && backupProcess.pid) {
      try {
        process.kill(backupProcess.pid);
        console.log(`${HANDLER_NAME} Backup watcher stopped`);
      } catch (e) {
        console.log(`${HANDLER_NAME} Failed to stop watcher: ${e}`);
      }
      backupProcess = null;
    }
  }
}
