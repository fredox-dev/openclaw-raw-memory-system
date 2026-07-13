# Configuration

<div align="center">

<a href="CONFIGURATION.md">English</a> | Français

</div>

## Vue d'ensemble

Toute la configuration est **optionnelle**. Le plugin fonctionne tel quel avec des valeurs par défaut sensibles et détecte automatiquement autant d'informations que possible.

## Priorité de configuration

Toutes les valeurs suivent le même système de priorité à 3 niveaux :

```
1. Variable d'environnement    (priorité la plus haute)
2. openclaw.json               (intermédiaire)
3. Valeur par défaut intégrée  (priorité la plus basse)
```

## Variables d'environnement

### Paramètres de sauvegarde

| Variable | Description | Valeur par défaut |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Où stocker les fichiers de sauvegarde | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Fréquence de scrutation des changements, en millisecondes | `600000` (10 min) |
| `TZ` | Fuseau horaire IANA pour le formatage des dates | Fuseau horaire système |

### Libellés d'affichage

| Variable | Description | Valeur par défaut |
|----------|-------------|---------|
| `RAW_MEMORY_USER_LABEL` | Libellé pour les messages utilisateur dans les sauvegardes | Auto-détecté depuis `openclaw.json`, ou `"User"` |
| `RAW_MEMORY_AGENT_MAIN` | Libellé pour l'agent `main` | Auto-détecté |
| `RAW_MEMORY_AGENT_PULSE` | Libellé pour l'agent `pulse` | Auto-détecté |
| `RAW_MEMORY_AGENT_LUMINA` | Libellé pour l'agent `lumina` | Auto-détecté |
| `RAW_MEMORY_AGENT_ATLAS` | Libellé pour l'agent `atlas` | Auto-détecté |
| `RAW_MEMORY_AGENT_LEXIS` | Libellé pour l'agent `lexis` | Auto-détecté |

**Modèle** : `RAW_MEMORY_AGENT_<AGENTID>` où `<AGENTID>` est l'ID de l'agent en majuscules. Fonctionne pour **n'importe quel** ID d'agent, pas seulement ceux listés ci-dessus. Par exemple, si vous avez un agent nommé `nova`, utilisez `RAW_MEMORY_AGENT_NOVA`.

### Paramètres de chemins

| Variable | Description | Valeur par défaut |
|----------|-------------|---------|
| `OPENCLAW_BASE` | Répertoire de base d'OpenClaw | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Répertoire contenant les sessions d'agents | `~/.openclaw/agents` |
| `OPENCLAW_WORKSPACE_BASE` | Racine de l'espace de travail OpenClaw (utilisé par l'outil de recherche) | `~/.openclaw` |

## Configuration via openclaw.json

Vous pouvez définir la configuration dans `~/.openclaw/openclaw.json`. Le plugin lit les noms d'agents et d'utilisateur depuis ce fichier automatiquement — pas besoin de section spécifique au plugin.

### Auto-détection des libellés d'agents

Le watcher recherche les noms d'agents dans `openclaw.json` via ces chemins :

```json
{
  "user": {
    "name": "Fredox"
  },
  "agents": {
    "main": {
      "identity": {
        "name": "Alix"
      }
    },
    "pulse": {
      "identity": {
        "name": "Pulse"
      }
    },
    "atlas": {
      "identity": {
        "name": "Atlas"
      }
    }
  }
}
```

### Ordre de résolution

Pour chaque libellé d'agent :

```
1. Variable d'environnement : RAW_MEMORY_AGENT_<ID>     → ex. « Alix »
2. openclaw.json : agents.<id>.identity.name             → ex. « Alix »
3. Valeur par défaut : capitalize(agentId)               → ex. « Main »
```

Pour le libellé utilisateur :

```
1. Variable d'environnement : RAW_MEMORY_USER_LABEL  → ex. « Fredox »
2. openclaw.json : user.name                          → ex. « Fredox »
3. Valeur par défaut : "User"
```

### Configuration des hooks dans openclaw.json

Vous pouvez également passer la configuration via la section hooks :

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/chemin/personnalise",
            "RAW_MEMORY_POLL_INTERVAL": 300000,
            "RAW_MEMORY_USER_LABEL": "Fredox"
          }
        }
      }
    }
  }
}
```

## Configuration du fuseau horaire

Le plugin utilise un formatage des dates prenant en compte le fuseau horaire pour s'assurer que les fichiers quotidiens sont découpés à minuit dans le fuseau horaire local de l'utilisateur, pas en UTC.

### Ordre de résolution

```
1. process.env.TZ                              → ex. "Europe/Paris"
2. Intl.DateTimeFormat().resolvedOptions().timeZone → valeur système par défaut
3. Valeur par défaut : "UTC"
```

Définissez la variable d'environnement `TZ` si la détection de votre fuseau horaire système ne fonctionne pas comme prévu :

```bash
export TZ="Europe/Paris"
openclaw gateway restart
```

## Exemples

### Exemple 1 : Configuration par défaut (zéro config)

```bash
# Installez et c'est parti — tout utilise les valeurs par défaut
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
openclaw plugins enable openclaw-raw-memory-system
openclaw gateway restart
```

Aucune variable d'environnement, aucun changement dans le fichier de config. Le plugin détecte automatiquement le fuseau horaire et les noms d'agents.

### Exemple 2 : Libellés personnalisés via variables d'environnement

```bash
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"

openclaw gateway restart
```

### Exemple 3 : Chemin de sauvegarde personnalisé

```bash
# Stocker les sauvegardes sur un disque séparé
export RAW_MEMORY_BACKUP_PATH="/mnt/backup/openclaw-raw-memory"
openclaw gateway restart
```

### Exemple 4 : Scrutation plus rapide

```bash
# Scruter toutes les 2 minutes au lieu de 10
export RAW_MEMORY_POLL_INTERVAL=120000
openclaw gateway restart
```

### Exemple 5 : Configuration complète via openclaw.json

```json
{
  "user": {
    "name": "Fredox"
  },
  "agents": {
    "main": { "identity": { "name": "Alix" } },
    "pulse": { "identity": { "name": "Pulse" } },
    "lumina": { "identity": { "name": "Lumina" } },
    "atlas": { "identity": { "name": "Atlas" } },
    "lexis": { "identity": { "name": "Lexis" } }
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/mnt/backup/openclaw-raw-memory",
            "RAW_MEMORY_POLL_INTERVAL": 300000
          }
        }
      }
    }
  }
}
```

## Vérifier la configuration

Après avoir modifié la configuration, vérifiez que le watcher a bien pris en compte vos paramètres :

```bash
# Vérifier le runtime du plugin
openclaw plugins inspect openclaw-raw-memory-system --runtime --json

# Vérifier les logs du watcher (visibles dans les logs du gateway)
openclaw gateway logs | grep "raw-backup"

# Vérifier le répertoire de sauvegarde
ls -la ~/.openclaw/raw-memory-backup/

# Vérifier le statut de recherche
node ~/.openclaw/plugins/openclaw-raw-memory-system/skill/scripts/search.js status --agent main
```

Le watcher enregistre sa configuration au démarrage, y compris le fuseau horaire résolu, le libellé utilisateur et le mapping des agents.
