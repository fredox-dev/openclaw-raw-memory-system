/**
 * types.js — Type definitions for raw memory system
 *
 * These JSDoc typedefs provide IDE support without requiring TypeScript.
 * The project stays pure JavaScript for zero-dependency portability.
 */

/**
 * @typedef {Object} RawMemoryConfig
 * @property {string} openclawBase   - OpenClaw base directory (~/.openclaw)
 * @property {string} agentsDir      - Agents directory
 * @property {string} backupBase     - Backup output directory
 * @property {number} pollInterval   - Poll interval in milliseconds
 * @property {string} timezone       - IANA timezone (e.g. "Europe/Paris")
 * @property {string} userLabel      - Display name for user messages
 * @property {Object<string, string>} agentMapping - agentId → display name
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} timestamp     - ISO timestamp of the matched message
 * @property {string} date          - Date string (YYYY-MM-DD)
 * @property {string} snippet       - Conversation context around match
 * @property {string} source        - Source filename
 * @property {string} contextRange  - Human-readable context size
 */

/**
 * @typedef {Object} SearchResponse
 * @property {SearchResult[]} results - Matched results
 * @property {number} total          - Total matches before limit
 * @property {string} [error]        - Error message if any
 */

/**
 * @typedef {Object} AgentSession
 * @property {string} agentId       - Agent identifier
 * @property {string} sessionsPath  - Path to sessions directory
 */

/**
 * @typedef {Object} WatcherState
 * @property {number} lastSize      - Last processed file size in bytes
 * @property {number} lastCheck     - Last check timestamp (Date.now())
 */

/**
 * @typedef {Object} BackupEntry
 * @property {string} timestamp     - Formatted timestamp
 * @property {string} label         - Display name (user or agent)
 * @property {string} text          - Message content
 * @property {string} source        - Source identifier
 */

module.exports = {};
