# Architecture

<div align="center">

<a href="ARCHITECTURE.md">English</a> | Français

</div>

## Vue d'ensemble

Le Raw Memory System est un plugin OpenClaw à deux composants :

1. **Daemon de sauvegarde** (`src/watcher.js`) — s'exécute comme processus en arrière-plan, scrute le stockage des sessions d'agents (SQLite ou JSONL legacy, détecté par agent au runtime) et écrit des sauvegardes Markdown quotidiennes.
2. **Outil de recherche** (`src/search.js` et `skill/scripts/search.js`) — outil en ligne de commande pour rechercher des mots-clés dans les fichiers de sauvegarde avec une fenêtre de contexte.

Le point d'entrée du plugin (`dist/index.js`) utilise l'API de plugin OpenClaw (`register(api)` avec `api.registerHook()`) pour démarrer et arrêter le watcher en même temps que le cycle de vie du Gateway.

## Flux du système

```
┌──────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                       │
│                                                              │
│  ┌─────────────┐ SQLite/JSONL ┌─────────────────────┐        │
│  │ Sessions    │ ──────────►  │ Stockage des        │        │
│  │ des agents  │              │ sessions            │        │
│  │             │              │ (~/.openclaw/agents)│        │
│  └─────────────┘              └─────────┬───────────┘        │
│                                          │                   │
│  ┌──────────────────────────────────────┘                    │
│  │ Événement gateway:startup                                 │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ dist/index.js (Point d'entrée du plugin)          │       │
│  │  register(api) {                                  │       │
│  │    api.registerHook('gateway:startup', ...)       │       │
│  │    api.registerHook('gateway:shutdown', ...)      │       │
│  │  }                                                │       │
│  │  └─ lance watcher.js comme processus détaché      │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────┘                                    │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ src/watcher.js (Daemon de sauvegarde)             │       │
│  │  ├─ Détecte le stockage par agent (SQLite/JSONL)   │       │
│  │  ├─ Scrute toutes les 10 min (configurable)        │       │
│  │  ├─ SQLite : lit transcript_events (lecture seule) │       │
│  │  ├─ JSONL : lecture incrémentale des fichiers      │       │
│  │  ├─ Décompresse les événements zstd (node:zlib)    │       │
│  │  ├─ Analyse les messages (user/assistant uniquement)│       │
│  │  ├─ Regroupe par date (fuseau horaire local)       │       │
│  │  ├─ Ajoute aux fichiers .md quotidiens (sans écrasement) │ │
│  │  └─ Suivi d'état incrémental (state v3)            │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────┐       │
│  │ ~/.openclaw/raw-memory-backup/                    │       │
│  │  ├─ main/2026-07-08.md                            │       │
│  │  ├─ pulse/2026-07-08.md                           │       │
│  │  ├─ atlas/2026-07-08.md                           │       │
│  │  └─ watcher-state-v3.json                         │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────┘                                    │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ skill/scripts/search.js (Outil de recherche)      │       │
│  │  ├─ Recherche par mots-clés (logique ET)           │       │
│  │  ├─ Fenêtre de contexte (3+1+3 phrases)            │       │
│  │  ├─ Filtrage par date (--from / --to)              │       │
│  │  └─ Rapport de statut                              │       │
│  └───────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

## Backends de stockage

Le watcher supporte les deux formats de stockage de sessions OpenClaw. Le mode est détecté **par agent au runtime** — par présence des fichiers, jamais par numéro de version d'OpenClaw :

| Mode | Source | Utilisé quand |
|------|--------|---------------|
| **SQLite** (priorité) | `agents/<id>/agent/openclaw-agent.sqlite` — table `transcript_events` | OpenClaw >= 2026.8.1 |
| **JSONL legacy** | `agents/<id>/sessions/*.jsonl` | Versions antérieures d'OpenClaw |

Si la base SQLite existe pour un agent, le mode SQLite prime ; sinon l'agent bascule en JSONL. Les montées de version sont donc transparentes : dès qu'OpenClaw migre un agent vers SQLite, le watcher suit automatiquement.

### Mode SQLite

- **Garantie lecture seule** — la base est ouverte via `DatabaseSync` de `node:sqlite` en mode `readOnly: true`. Le plugin n'écrit jamais dans les bases du gateway.
- **Compression** — les événements peuvent être stockés compressés en zstd (colonne `event_zstd`). Ils sont décompressés via `zlib.zstdDecompressSync` natif de Node, d'où l'exigence Node >= 24.
- **Suivi incrémental** — les clés d'état sont préfixées `sqlite:<agentId>:<sessionId>` et mémorisent le dernier `seq` traité par session ; seuls les événements plus récents sont lus.
- **Lectures par lots** — les événements sont lus par lots de 2000 lignes pour limiter la mémoire sur les grosses sessions.
- **Resets de session** — si le `MAX(seq)` d'une session régresse sous l'offset mémorisé (session reset), le watcher la relit depuis 0 et journalise un avertissement ; des doublons dans le fichier du jour sont possibles.

### Backfill au premier run (mode SQLite)

Quand un agent n'a pas encore d'état SQLite, le watcher détermine le point de départ de la collecte :

1. `RAW_MEMORY_BACKFILL_FROM` (date ISO) — priorité la plus haute
2. `RAW_MEMORY_BACKFILL_DAYS` (jours en arrière depuis maintenant)
3. Minuit du **dernier `.md` quotidien existant** pour cet agent — avec 1 jour de chevauchement par design, pour ne jamais perdre la fin du dernier jour sauvegardé (des doublons dans le fichier du jour sont possibles et sans conséquence)
4. Sinon : **historique complet** (le premier run sur une installation neuve peut prendre du temps)

## Intégration à l'API Plugin

### Point d'entrée (`dist/index.js`)

Le plugin utilise l'API plugin OpenClaw v2 avec le modèle `register(api)` :

```javascript
module.exports = {
  id: 'openclaw-raw-memory-system',
  name: 'OpenClaw Raw Memory System',

  register(api) {
    api.registerHook('gateway:startup', async () => {
      // Lance watcher.js comme processus en arrière-plan détaché
      backupProcess = spawn('node', [watcherScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      backupProcess.unref();
    }, {
      name: 'raw-backup-start',
      description: 'Start the raw memory backup watcher on gateway startup',
    });

    api.registerHook('gateway:shutdown', async () => {
      // Tue le processus watcher
      process.kill(backupProcess.pid);
    }, {
      name: 'raw-backup-stop',
      description: 'Stop the raw memory backup watcher on gateway shutdown',
    });
  },
};
```

### Manifeste (`openclaw.plugin.json`)

Le manifeste `openclaw.plugin.json` déclare les hooks du plugin, le schéma de configuration et les métadonnées du skill. Ce fichier est lu par le gestionnaire de plugins OpenClaw lors de la découverte.

## Résolution de configuration

Toute la configuration suit un système de priorité à 3 niveaux :

```
Variable d'environnement  ──►  openclaw.json  ──►  valeur par défaut intégrée
     (la plus haute)            (intermédiaire)        (la plus basse)
```

### Détails de résolution

| Paramètre | Variable d'environnement | Chemin dans openclaw.json | Valeur par défaut |
|---------|-------------|-------------------|----------|
| Chemin de sauvegarde | `RAW_MEMORY_BACKUP_PATH` | — | `~/.openclaw/raw-memory-backup` |
| Intervalle de scrutation | `RAW_MEMORY_POLL_INTERVAL` | — | `600000` (10 min) |
| Fuseau horaire | `TZ` | — | Fuseau horaire système via `Intl.DateTimeFormat` |
| Libellé utilisateur | `RAW_MEMORY_USER_LABEL` | `user.name` | `"User"` |
| Libellé d'agent | `RAW_MEMORY_AGENT_<ID>` | `agents.<id>.identity.name` | ID de l'agent capitalisé |
| Départ du backfill | `RAW_MEMORY_BACKFILL_FROM` / `RAW_MEMORY_BACKFILL_DAYS` | — | Dernier `.md` quotidien (minuit, +1 jour de chevauchement) |

### Auto-détection des agents

Si aucune variable d'environnement `RAW_MEMORY_AGENT_*` n'est définie, le watcher lit `~/.openclaw/openclaw.json` et extrait les noms d'agents depuis :

1. Le tableau `agents.list` (la propriété `identity.name` de chaque élément)
2. L'objet `agents` (la propriété `identity.name` de chaque clé)

Si aucun des deux n'existe, l'ID de l'agent est capitalisé (ex. `main` → `Main`).

## Gestion de l'état

Le watcher maintient un fichier d'état (`watcher-state-v3.json`) dans le répertoire de sauvegarde :

```json
{
  "main:session-abc123": {
    "lastSize": 45678,
    "lastCheck": 1720828800000
  },
  "sqlite:main:session-xyz789": {
    "lastSeq": 1234,
    "lastCheck": 1720915200000
  }
}
```

- **Clés JSONL legacy** (`<agentId>:<sessionId>`) : dernière taille de fichier traitée (`lastSize`).
- **Clés SQLite** (préfixe `sqlite:`) : dernier numéro de séquence d'événement traité par session (`lastSeq`).

Cela permet la **sauvegarde incrémentale** — seules les données modifiées depuis la dernière vérification sont traitées. Le fichier d'état est migré automatiquement depuis `watcher-state-v2.json` au premier démarrage (même format, offsets legacy préservés — le fichier est simplement renommé).

## Relation avec les autres systèmes

| Système | Rôle | Relation |
|--------|------|-------------|
| **Memory Sync d'OpenClaw** | Résumés sélectionnés (`MEMORY.md`) | Complémentaire — la sauvegarde brute fournit les données source que Memory Sync distille |
| **LanceDB** | Recherche sémantique vectorielle | Indépendant — ce système utilise la correspondance de texte exacte, pas d'embeddings |
| **Cron Memory Sync** | Maintenance programmée | Peut invoquer `cleanup.sh` pour nettoyer les anciennes sauvegardes |
| **Dreaming** | Traitement hors heures d'agent | Peut lire les sauvegardes brutes pour une analyse approfondie et la détection de motifs |
| **`memory_search` intégré** | Rappel de mémoire d'agent | Utiliser la recherche de mémoire brute comme solution de repli quand la mémoire intégrée est insuffisante |

### Flux type de récupération de mémoire

```
Requête de l'agent
  → memory_search (sémantique LanceDB)
  → MEMORY.md (sélectionné)
  → Recherche Raw Memory (ce système, correspondance exacte)
  → Promouvoir les résultats dans MEMORY.md
```

## Caractéristiques de performance

| Métrique | Valeur |
|--------|-------|
| Temps de sauvegarde par agent et par scrutation | < 1s (typique) |
| Temps de recherche pour 30 jours de conversations | < 100 ms |
| Utilisation disque par agent et par jour | ~50–100 Ko |
| Utilisation mémoire pour 100 fichiers | ~10 Mo |
| Premier run (historique complet) | Dépend de la taille de l'historique (lectures par lots de 2000 événements) |
| Dépendances externes | **Zéro** — built-ins Node >= 24 uniquement (`node:sqlite`, `node:zlib`) |
| Coût en tokens | **Zéro** (aucun appel à un LLM) |
