# Recherche Raw Memory

<div align="center">

<a href="README.md">English</a> | Français

</div>

Recherche dans les sauvegardes complètes et non sélectionnées de conversations stockées par le plugin `openclaw-raw-memory-system`.

## Objectif

Quand la mémoire intégrée (`MEMORY.md`, LanceDB) ne contient pas les détails spécifiques, recherchez dans les journaux de conversations brutes pour trouver des citations exactes, des promesses oubliées ou des pistes d'audit.

## Structure des fichiers

```
skill/
├── SKILL.md                 # Flux de travail principal (<500 lignes)
├── README.md                # Ce fichier
├── references/
│   └── search-tool.md       # Référence détaillée de l'outil
└── scripts/
    ├── search.js            # Outil de recherche et de statut
    └── cleanup.sh           # Nettoyage des anciennes sauvegardes
```

## Démarrage rapide

```bash
# Rechercher les mentions de "météo" dans les conversations de l'agent main
node scripts/search.js search --agent main --query "météo" --limit 5

# Rechercher dans une plage de dates
node scripts/search.js search --agent main --query "base de données" --from 2026-07-01 --to 2026-07-10

# Vérifier le statut des sauvegardes d'un agent
node scripts/search.js status --agent main

# Nettoyer les sauvegardes de plus de 90 jours
./scripts/cleanup.sh --agent main --days 90
```

> **Note :** La sous-commande `search` ou `status` est requise comme premier argument.

## Prérequis

- Le plugin `openclaw-raw-memory-system` doit être installé et en cours d'exécution
- Emplacement des sauvegardes : `~/.openclaw/raw-memory-backup/<agent>/<date>.md`
- Node.js installé

## Comment ça marche

1. Le plugin `openclaw-raw-memory-system` exécute un watcher en arrière-plan qui sauvegarde les conversations des agents dans des fichiers Markdown quotidiens
2. Le script `search.js` de ce skill lit ces fichiers et effectue une correspondance par mots-clés avec une fenêtre de contexte
3. Les résultats incluent le contexte environnant (3 messages avant + correspondance + 3 après = 7 au total)

## Intégration

Ce skill est conçu comme solution de repli quand :

1. **LanceDB** (recherche sémantique) ne renvoie pas de résultats pertinents
2. **MEMORY.md** (mémoire sélectionnée) ne contient pas l'information
3. L'agent a besoin de citations exactes ou d'un libellé précis

Le flux type :
```
Requête de l'agent → LanceDB → MEMORY.md → Raw Memory (ce skill) → Promouvoir dans MEMORY.md
```

## Efficacité en tokens

- **SKILL.md** : ~500 tokens (chargé par l'agent à la demande)
- **Références** : chargées à la demande quand nécessaire
- **Scripts** : pur fichier I/O, aucun appel à un LLM

## Sécurité

- **Lecture seule** : la recherche ne fait que lire des fichiers locaux
- **Pas de réseau** : opérations purement locales sur des fichiers
- **Pas de privilèges** : aucun sudo, aucun accès root requis

## Maintenance

- **Sauvegarde quotidienne** : gérée automatiquement par le plugin `openclaw-raw-memory-system`
- **Nettoyage** : exécuter `cleanup.sh` chaque semaine ou chaque mois pour nettoyer les anciens fichiers
- **Stockage** : ~20–35 Mo par an et par agent (usage typique)

## Crédits

Basé sur [openclaw-memory-system](https://github.com/oceanwh/openclaw-memory-system) par [oceanwh](https://github.com/oceanwh) (licence MIT).
Refactorisé pour l'API plugin OpenClaw v2 par la [Xylem Team](https://github.com/xylem-team) (2026-07-12).

## Licence

MIT — voir [LICENSE](../../LICENSE)
