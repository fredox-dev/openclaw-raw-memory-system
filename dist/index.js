/**
 * dist/index.js — OpenClaw Plugin Entry Point
 *
 * Raw Memory System v2.0.0
 * Forked from oceanwh/openclaw-memory-system
 *
 * Uses the new OpenClaw plugin API (api.on()) for lifecycle hooks.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let backupProcess = null;

function getWatcherPath() {
  // Try multiple locations
  const pluginDir = path.dirname(__filename);
  const localWatcher = path.join(pluginDir, '..', 'src', 'watcher.js');
  if (fs.existsSync(localWatcher)) return localWatcher;

  // Fallback: installed plugin path
  return path.join(pluginDir, 'watcher.js');
}

module.exports = {
  name: 'openclaw-memory-system',
  version: '2.0.0',

  setup(api) {
    // Hook: gateway:startup — start backup watcher
    api.on('gateway:startup', async () => {
      if (backupProcess) {
        api.log('Raw memory backup already running');
        return;
      }

      const watcherScript = getWatcherPath();

      if (!fs.existsSync(watcherScript)) {
        api.log(`Watcher script not found: ${watcherScript}`, 'error');
        return;
      }

      backupProcess = spawn('node', [watcherScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });

      backupProcess.unref();

      api.log(`Raw memory backup watcher started (PID: ${backupProcess.pid})`);
    });

    // Hook: gateway:shutdown — stop backup watcher
    api.on('gateway:shutdown', async () => {
      if (backupProcess && backupProcess.pid) {
        try {
          process.kill(backupProcess.pid);
          api.log('Raw memory backup watcher stopped');
        } catch (e) {
          api.log(`Failed to stop watcher: ${e.message}`, 'error');
        }
        backupProcess = null;
      }
    });
  },
};
