# Guide de migration

<div align="center">

<a href="MIGRATION.md">English</a> | Français

</div>

## Migration de v2.x vers v3.0 (stockage SQLite)

La v3.0 ajoute le support du nouveau stockage SQLite des sessions OpenClaw (OpenClaw >= 2026.8.1) tout en gardant une compatibilité complète avec le JSONL legacy.

### Ce qui a changé

| Aspect | v2.x | v3.0 |
|--------|------|------|
| Stockage de sessions lu | JSONL uniquement | **Double : SQLite (priorité) ou JSONL** — détection par agent au runtime, par présence des fichiers |
| Source SQLite | — | `agents/<id>/agent/openclaw-agent.sqlite` (table `transcript_events` ; événements compressés en zstd décompressés nativement) |
| Fichier d'état | `watcher-state-v2.json` | `watcher-state-v3.json` (migré automatiquement depuis v2 — même format, offsets préservés) |
| Version de Node.js | — | **Node >= 24** (zstd natif ; OpenClaw exige de toute façon Node 24.16+) |
| Dépendances npm | Zéro | Zéro (inchangé) — built-ins `node:sqlite` + `node:zlib` |
| Format `.md` des sauvegardes | Fichiers quotidiens | **Inchangé** — les sauvegardes existantes et le skill de recherche restent valides |
| Nouveau flag | — | `--once` (un seul cycle de scrutation, pour tests/cron) |
| Nouvelles variables d'environnement | — | `RAW_MEMORY_BACKFILL_FROM`, `RAW_MEMORY_BACKFILL_DAYS` |

### Migration étape par étape

#### 1. Vérifier Node.js

```bash
node --version   # doit être >= 24
```

#### 2. Mettre à jour le plugin

```bash
openclaw plugins update openclaw-raw-memory-system
# ou réinstaller :
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
openclaw plugins enable openclaw-raw-memory-system
```

#### 3. Redémarrer le Gateway

```bash
openclaw gateway restart
```

#### 4. Vérifier

```bash
# Les sauvegardes continuent d'apparaître
ls ~/.openclaw/raw-memory-backup/

# Le fichier d'état est migré automatiquement
cat ~/.openclaw/raw-memory-backup/watcher-state-v3.json
```

### Ce qui se passe automatiquement

- **Détection du stockage** — chaque agent est testé pour `agent/openclaw-agent.sqlite` ; si la base existe, le mode SQLite est utilisé, sinon JSONL legacy. Sur OpenClaw < 2026.8.1 rien ne change : le mode JSONL continue comme avant.
- **Migration de l'état** — `watcher-state-v2.json` est renommé en `watcher-state-v3.json` au premier démarrage. Même format : vos offsets JSONL existants sont préservés.
- **Premier run SQLite** — pour chaque agent, la sauvegarde reprend depuis le dernier `.md` quotidien existant (1 jour de chevauchement par design ; des doublons dans le fichier du jour sont possibles et sans conséquence). Surcharge avec `RAW_MEMORY_BACKFILL_FROM` / `RAW_MEMORY_BACKFILL_DAYS`.
- **Sécurité** — les bases du gateway sont ouvertes strictement en lecture seule ; le plugin n'écrit jamais dedans.

### Changements cassants

- **Node.js >= 24 est requis** (`engines: ">=24.0.0"` dans `package.json`).
- Aucun sur la sortie : le format `.md` des sauvegardes, l'arborescence et le skill de recherche sont inchangés. Les sauvegardes existantes restent valides et consultables.

---

## Migration de v1 (`openclaw-raw-memory`) vers v2 (`openclaw-raw-memory-system`)

### Ce qui a changé

| Aspect | v1 | v2 |
|--------|----|----|
| Nom du plugin | `openclaw-raw-memory` | `openclaw-raw-memory-system` |
| API Plugin | Ancien format de hook | Nouveau `register(api)` avec `api.registerHook()` |
| Manifeste du plugin | — | `openclaw.plugin.json` ajouté |
| Fuseau horaire | UTC+8 codé en dur | Fuseau horaire système (auto-détecté, configurable) |
| Libellé utilisateur | Chinois codé en dur (`主人`) | Configurable via ENV ou `openclaw.json` (défaut : `User`) |
| Mapping des agents | Codé en dur (`loli`, `main`) | Auto-détecté depuis `openclaw.json` ou variables d'environnement |
| Structure | `hook/`, `skill/raw-tools.js` | `dist/`, `src/`, `skill/scripts/` |
| Langue du SKILL.md | Chinois | Anglais |
| Documentation | Minimale | Documentation complète dans `docs/` |

### Migration étape par étape

#### 1. Désactiver l'ancien plugin

```bash
openclaw plugins disable openclaw-raw-memory
```

#### 2. Installer le nouveau plugin

```bash
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
openclaw plugins enable openclaw-raw-memory-system
```

#### 3. Redémarrer le Gateway

```bash
openclaw gateway restart
```

#### 4. Vérifier

```bash
# Vérifier que le plugin est chargé et que les hooks sont actifs
openclaw plugins inspect openclaw-raw-memory-system --runtime --json

# Vérifier que les sauvegardes sont créées (patienter quelques minutes après le redémarrage)
ls ~/.openclaw/raw-memory-backup/

# Tester la recherche
node ~/.openclaw/plugins/openclaw-raw-memory-system/skill/scripts/search.js status --agent main
```

### Sauvegardes existantes

**Vos fichiers de sauvegarde existants sont préservés.** Le watcher v2 lit et écrit dans le même chemin par défaut (`~/.openclaw/raw-memory-backup/`). Les fichiers `.md` existants restent valides et consultables.

Si vous utilisiez un chemin de sauvegarde personnalisé, définissez `RAW_MEMORY_BACKUP_PATH` pour correspondre à votre emplacement précédent :

```bash
export RAW_MEMORY_BACKUP_PATH="/votre/chemin/de/sauvegarde/existant"
openclaw gateway restart
```

### Optionnel : Configurer les libellés

Si vous souhaitez des libellés personnalisés au lieu des valeurs par défaut auto-détectées :

```bash
# Définir via des variables d'environnement
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"

openclaw gateway restart
```

Ou configurez-les dans `openclaw.json` (voir [CONFIGURATION_fr.md](CONFIGURATION_fr.md) pour plus de détails).

### Optionnel : Supprimer l'ancien plugin

```bash
openclaw plugins uninstall openclaw-raw-memory
```

### Changements cassants

- **Nom du plugin modifié** : `openclaw-raw-memory` → `openclaw-raw-memory-system`
- **Script de recherche renommé et déplacé** : `skill/raw-tools.js` → `skill/scripts/search.js`
- **Syntaxe CLI de recherche modifiée** : une sous-commande `search` ou `status` est désormais requise comme premier argument
- **Commande `save` supprimée** : le watcher gère toutes les sauvegardes automatiquement. La commande `save` manuelle n'est plus nécessaire.
- **Libellés modifiés** : `主人` → configurable (défaut : `User`). Les libellés en chinois ne sont plus codés en dur.
- **Fuseau horaire modifié** : UTC+8 codé en dur → fuseau horaire système (auto-détecté). Les limites des fichiers quotidiens suivent maintenant votre fuseau horaire local.

### Mettre à jour les skills des agents

Si vos agents font référence à l'ancien chemin de script ou à l'ancienne syntaxe :

```bash
# Ancien (v1)
node skill/raw-tools.js search --agent main --query "mot-clé"

# Nouveau (v2) — notez la sous-commande `search`
node skill/scripts/search.js search --agent main --query "mot-clé"
```

Mettez également à jour tous les fichiers `SKILL.md` des skills qui font référence aux anciens chemins pour les pointer vers `skill/scripts/search.js`.
