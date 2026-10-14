# AnoTrack

Classement anonyme des notes de DS pour une classe de prépa.

Le professeur rend les notes mais pas le classement ? Chaque élève dépose sa note sur AnoTrack et reçoit un numéro anonyme. Quand toute la classe a participé, le classement complet est publié, sans aucun nom. Chacun connaît son rang, personne ne connaît celui des autres.

## Fonctionnement

1. L'administrateur crée un DS (matière, titre, nombre de copies attendues).
2. Chaque élève s'identifie avec un code personnel et dépose sa note.
3. Tant que toutes les notes ne sont pas arrivées, rien n'est visible.
4. Une fois le compte atteint, le classement anonyme et l'histogramme des notes sont publiés.

## Fonctionnalités

- Classement anonyme par DS, avec histogramme des notes
- Page « Mon évolution » qui suit son propre rang d'un DS à l'autre
- QR code de projection pour partager un DS en classe
- Protection contre le brute-force sur les codes élèves et le mot de passe administrateur
- Installable sur téléphone (PWA)
- Page de confidentialité (RGPD) : seules les notes et un numéro anonyme sont stockés

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Hono, tRPC 11 |
| Base de données | MySQL 8, Drizzle ORM |

Tout tient dans un seul processus Node : le serveur sert à la fois l'API (`/api/trpc/*`) et le frontend compilé. Les tables sont créées automatiquement au premier démarrage.

## Lancer en local

```bash
npm install
cp .env.example .env    # renseigner DATABASE_URL, APP_ID et APP_SECRET
npm run dev
```

Pour la production : `npm run build` puis `npm start` (port 3000 par défaut, variable `PORT` respectée). Le guide complet de déploiement sur un VPS (nginx, HTTPS, systemd) est dans [deploiement-vps.md](deploiement-vps.md).
