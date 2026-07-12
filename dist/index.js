/**
 * dist/index.js — OpenClaw Plugin Entry Point
 *
 * Raw Memory System v2.0.0
 * Forked from oceanwh/openclaw-memory-system
 *
 * Uses the OpenClaw plugin API: register(api) with registerHook().
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let backupProcess = null;

function getWatcherPath(pluginDir) {
  // Try src/ as sibling of dist/ (plugin root is parent of dist/)
  const srcWatcher = path.join(pluginDir, '..', 'src', 'watcher.js');
  if (fs.existsSync(srcWatcher)) return srcWatcher;

  // Fallback: watcher.js inside dist/ (bundled)
  const distWatcher = path.join(pluginDir, 'watcher.js');
  if (fs.existsSync(distWatcher)) return distWatcher;

  return null;
}

module.exports = {
  id: 'openclaw-memory-system',
  name: 'OpenClaw Memory System',
  description: 'Raw conversation backup system — zero token cost, full fidelity, searchable.',

  register(api) {
    const pluginDir = path.dirname(__filename);
    const watcherScript = getWatcherPath(pluginDir);

    if (!watcherScript) {
      api.log?.(`Watcher script not found in ${pluginDir}`, 'error');
      return;
    }

    // Hook: gateway:startup — start backup watcher
    api.registerHook('gateway:startup', async () => {
      if (backupProcess) {
        api.log?.('Raw memory backup already running');
        return;
      }

      backupProcess = spawn('node', [watcherScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });

      backupProcess.unref();

      api.log?.(`Raw memory backup watcher started (PID: ${backupProcess.pid})`);
    }, {
      name: 'raw-backup-start',
      description: 'Start the raw memory backup watcher on gateway startup',
    });

    // Hook: gateway:shutdown — stop backup watcher
    api.registerHook('gateway:shutdown', async () => {
      if (backupProcess && backupProcess.pid) {
        try {
          process.kill(backupProcess.pid);
          api.log?.('Raw memory backup watcher stopped');
        } catch (e) {
          api.log?.(`Failed to stop watcher: ${e.message}`, 'error');
        }
        backupProcess = null;
      }
    }, {
      name: 'raw-backup-stop',
      description: 'Stop the raw memory backup watcher on gateway shutdown',
    });
  },
};
