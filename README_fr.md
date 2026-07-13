<div align="center">

# 🧠 OpenClaw Raw Memory System

**OpenClaw Raw Memory System — un outil de sauvegarde et de récupération automatisé**

[![Platform: OpenClaw](https://img.shields.io/badge/Platform-OpenClaw-red.svg)](https://github.com/openclaw/openclaw) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

<a href="README.md">English</a> | Français

</div>
 
> **Votre agent l'a dit. Maintenant vous pouvez le prouver.**

Sauvegarde gratuite et en haute fidélité de toutes les conversations que vos agents OpenClaw ont eues. Consultable, lisible par l'humain, et sans aucun appel à un LLM.

## Le problème

Le système de mémoire intégré d'OpenClaw est excellent — il compresse les conversations en fichiers `MEMORY.md` soigneusement sélectionnés. Mais qu'advient-il des **conversations brutes** ?

- L'agent a dit quelque chose d'important il y a 3 jours ? **Perdu après la compression.**
- Besoin d'auditer ce que votre agent a réellement dit ? **Aucun enregistrement n'existe.**
- Envie de chercher une citation précise dans toutes les sessions ? **Impossible.**
- La mémoire de l'agent semble « décalée » et vous ne savez pas pourquoi ? **Aucune trace à suivre.**

**Le système intégré retient les temps forts. Ce système retient tout.**

---

## La solution

OpenClaw Raw Memory System se branche sur le Gateway et sauvegarde automatiquement chaque conversation d'agent dans des fichiers Markdown lisibles par l'humain — **sans aucun coût en tokens**.

```
L'agent parle → Le Gateway écrit en JSONL → Ce plugin lit le JSONL → Fichiers .md quotidiens
                                                                          ↓
                                                                  Consultables par les agents
```

### Ce que vous obtenez

| Fonctionnalité | Description |
|---------|-------------|
| 🔄 **Sauvegarde auto** | Démarre avec le Gateway, tourne en arrière-plan, s'arrête automatiquement |
| 📅 **Fichiers quotidiens** | Un fichier `.md` clair par agent et par jour |
| 🔍 **Recherche par agent** | Les agents peuvent interroger les conversations brutes quand la mémoire leur fait défaut |
| 💰 **Coût en tokens nul** | Le processus de sauvegarde n'appelle jamais de LLM — pur fichier I/O |
| 🌍 **Multiplateforme** | Windows, macOS, Linux |
| 📖 **Lisible par l'humain** | Ouvrez n'importe quel fichier dans n'importe quel éditeur de texte — pas de base de données binaire |
| ⚙️ **Zéro configuration** | Détection automatique du fuseau horaire, des noms d'agents depuis `openclaw.json` |

---

## Démarrage rapide

### 1. Installer le plugin

```bash
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
```

### 2. Activer et redémarrer

```bash
openclaw plugins enable openclaw-raw-memory-system
openclaw gateway restart
```

### 3. Vérifier que ça tourne

```bash
# Vérifier le statut du plugin
openclaw plugins inspect openclaw-raw-memory-system --runtime --json

# Les sauvegardes apparaissent ici après quelques minutes
ls ~/.openclaw/raw-memory-backup/
```

### 4. (Optionnel) Installer le skill de recherche

Copiez le skill fourni dans votre espace de travail pour que les agents puissent chercher dans les conversations brutes :

```bash
cp -r ~/.openclaw/plugins/openclaw-raw-memory-system/skill ~/.openclaw/workspace/skills/raw-memory
```

Les agents peuvent maintenant lancer une recherche :
```bash
node ~/.openclaw/workspace/skills/raw-memory/scripts/search.js search --agent main --query "mot-clé"
```

C'est tout. Le watcher démarre automatiquement avec le Gateway et sauvegarde les conversations toutes les 10 minutes. Aucune configuration supplémentaire n'est nécessaire.

---

## Comment ça marche

### Structure des sauvegardes

```
~/.openclaw/raw-memory-backup/
├── main/
│   ├── 2026-07-08.md
│   ├── 2026-07-09.md
│   └── 2026-07-10.md
├── pulse/
│   └── 2026-07-10.md
├── lumina/
│   └── 2026-07-10.md
└── ...
```

### À quoi ressemble un fichier de sauvegarde

```markdown
# RAW: 2026-07-08

--- 2026-07-08T09:15:32 | source:gateway ---
**User:** Aide-moi à vérifier la météo

--- 2026-07-08T09:15:35 | source:gateway ---
**Alix:** Bien sûr, je vérifie ça pour toi

--- 2026-07-08T14:20:00 | source:gateway ---
**User:** Écris un email au client
```

Chaque message, chaque horodatage — préservés exactement tels qu'ils se sont produits.

### Outil de recherche

Quand un agent découvre une information manquante dans sa mémoire, il peut chercher dans les conversations brutes :

```bash
# Chercher des mots-clés
node scripts/search.js search --agent main --query "mot-clé" --limit 3

# Chercher dans une plage de dates
node scripts/search.js search --agent main --query "base de données" --from 2026-07-01 --to 2026-07-10

# Vérifier le statut des sauvegardes
node scripts/search.js status --agent main
```

**Fonctionnalités de recherche :**
- **Correspondance par mots-clés** : tous les mots-clés doivent apparaître (logique ET)
- **Fenêtre de contexte** : 3 phrases avant + cible + 3 après = 7 phrases de contexte
- **Filtrage par date** : `--from` et `--to` pour les plages de dates
- **Tri** : résultats triés par horodatage, du plus récent au plus ancien

---

## Configuration

Toute la configuration est **optionnelle**. Le système détecte tout automatiquement par défaut.

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Chemin de stockage des sauvegardes | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Intervalle de scrutation en millisecondes | `600000` (10 min) |
| `TZ` | Fuseau horaire IANA pour le formatage des dates | Fuseau horaire système |
| `RAW_MEMORY_USER_LABEL` | Nom d'affichage pour les messages utilisateur | Auto-détecté ou `"User"` |
| `RAW_MEMORY_AGENT_MAIN` | Nom d'affichage pour l'agent `main` | Auto-détecté |
| `RAW_MEMORY_AGENT_PULSE` | Nom d'affichage pour l'agent `pulse` | Auto-détecté |
| `RAW_MEMORY_AGENT_LUMINA` | Nom d'affichage pour l'agent `lumina` | Auto-détecté |
| `RAW_MEMORY_AGENT_ATLAS` | Nom d'affichage pour l'agent `atlas` | Auto-détecté |
| `RAW_MEMORY_AGENT_LEXIS` | Nom d'affichage pour l'agent `lexis` | Auto-détecté |

**Modèle pour les agents** : `RAW_MEMORY_AGENT_<AGENTID>` où `<AGENTID>` est l'identifiant de l'agent en majuscules. Fonctionne pour n'importe quel agent, pas seulement ceux listés ci-dessus.

Voir [docs/CONFIGURATION_fr.md](docs/CONFIGURATION_fr.md) pour le guide de configuration complet.

---

## Comparaison

| | Mémoire intégrée OpenClaw | Ce système |
|---|---|---|
| **Ce qui est sauvegardé** | Résumés sélectionnés | Conversations brutes |
| **Coût en tokens** | Utilise des tokens pour la mémoire | Zéro token |
| **Recherche** | Sémantique (vectorielle) | Correspondance de texte exacte |
| **Lisible par l'humain** | Oui (Markdown) | Oui (Markdown) |
| **Piste d'audit** | ❌ Non | ✅ Oui |
| **Auto-récupération de l'agent** | Partielle | Complète (peut relire les conversations exactes) |
| **Stockage** | Fichiers de l'espace de travail | Répertoire de sauvegarde distinct |

**Ils sont complémentaires :** la mémoire intégrée pour l'usage quotidien, la sauvegarde brute pour quand vous avez besoin de l'image complète.

---

## Cas d'usage

- **🔍 Débogage du comportement d'un agent** — « Pourquoi mon agent a-t-il dit ça ? »
- **📜 Conformité & audit** — « Qu'est-ce que mon agent a promis à ce client ? »
- **🧩 Récupération de mémoire** — « Mon agent a oublié quelque chose d'important. »
- **📊 Analyse** — « Combien mon agent parle-t-il réellement ? »

---

## Documentation

- [Architecture](docs/ARCHITECTURE_fr.md) — Conception du système et flux de données
- [Configuration](docs/CONFIGURATION_fr.md) — Guide de configuration complet
- [Guide de migration](docs/MIGRATION_fr.md) — Migrer depuis la v1.x

---

## Crédits

Ce projet est un fork de [openclaw-memory-system](https://github.com/oceanwh/openclaw-memory-system) créé par **[oceanwh](https://github.com/oceanwh)**, à l'origine sous licence MIT.

Le refactor v2.0 a été réalisé par la [Xylem Team](https://github.com/xylem-team) pour supporter la nouvelle API de plugin OpenClaw (`register(api)` avec `registerHook()`), supprimer toutes les valeurs codées en dur et ajouter une documentation complète.

Tout le mérite du concept et de l'implémentation originaux revient à oceanwh. 🙏

---

## Licence

Licence MIT — voir [LICENSE](LICENSE). L'œuvre originale et ce fork sont tous deux publiés sous MIT.
