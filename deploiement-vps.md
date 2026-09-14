# Déploiement d'AnoTrack sur un VPS — guide d'exécution

> **À l'attention de l'agent (Claude Code) chargé du déploiement.**
> Ce document est une procédure complète et autonome. Exécute les étapes dans l'ordre.
> Chaque bloc de commandes est prévu pour Ubuntu/Debian. Adapte uniquement les valeurs
> indiquées entre `« … »` (domaine, mots de passe).

---

## 0. Ce que tu déploies

**AnoTrack** — site de classement anonyme de notes de DS pour une classe de prépa.

Architecture (tout tient dans **un seul processus Node**) :

| Couche | Technologie | Détail |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind | compilé en statique dans `dist/public/` |
| Backend | Hono + tRPC 11 | `api/boot.ts`, compilé en `dist/boot.js` |
| Base de données | MySQL 8 (via Drizzle ORM / mysql2) | tables créées automatiquement au 1er démarrage |

- **Un seul port** : le serveur Node (`npm start`, port `3000` par défaut, variable `PORT` respectée) sert à la fois l'API (`/api/trpc/*`) et le frontend statique.
- **Aucune migration manuelle** : l'application crée ses tables toute seule au premier appel (`students`, `exams`, `submissions`, `settings`). Il suffit de fournir une base **vide** et un utilisateur MySQL avec tous les droits dessus.
- **Pas de service externe** : pas de Kimi login, pas de SaaS tiers. Le seul secret nécessaire est `DATABASE_URL`.

---

## 1. Prérequis

- VPS Ubuntu 22.04/24.04 (ou Debian 11/12), accès root ou sudo.
- Un nom de domaine pointant vers l'IP du VPS (recommandé, pour HTTPS). Noté `« DOMAIN »` dans la suite (ex. `anotrack.mondomaine.fr`). Sans domaine, l'accès se fera en HTTP par l'IP — déconseillé (mots de passe en clair).
- Le dossier du projet (code source complet, **sans** `node_modules`, **sans** `.env`) disponible localement sous le nom `anotrack-site.zip`.

---

## 2. Paquets système

```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# MySQL 8 + nginx + certbot + unzip
apt install -y mysql-server nginx certbot python3-certbot-nginx unzip ufw

# Versions attendues : node >= 20, mysql >= 8.0
node -v && mysql --version
```

Pare-feu :

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 3. Base de données

```bash
mysql -u root <<'SQL'
CREATE DATABASE anotrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'anotrack'@'127.0.0.1' IDENTIFIED BY '« MOT_DE_PASSE_DB_FORT »';
GRANT ALL PRIVILEGES ON anotrack.* TO 'anotrack'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

Notes :
- Génère un mot de passe fort (ex. `openssl rand -base64 24`) et conserve-le pour l'étape 5.
- MySQL n'écoute que sur `127.0.0.1` par défaut : c'est ce qu'on veut, la base n'est pas exposée.
- Les tables seront créées automatiquement par l'application — **ne crée aucune table**.

---

## 4. Installation du code

Le fichier `anotrack-site.zip` doit d'abord être copié sur le VPS (depuis la machine locale de l'utilisateur) :

```bash
# exécuté en LOCAL par l'utilisateur ou par toi si tu as le fichier en local :
scp anotrack-site.zip « USER »@« IP_VPS »:/tmp/
```

Puis sur le VPS :

```bash
mkdir -p /opt/anotrack
cd /opt/anotrack
unzip /tmp/anotrack-site.zip
rm /tmp/anotrack-site.zip

# utilisateur dédié, non-root
useradd --system --home /opt/anotrack --shell /usr/sbin/nologin anotrack || true
```

---

## 5. Configuration — fichier `.env`

**Important** : ne JAMAIS copier le `.env` fourni par la plateforme d'origine (il contient des identifiants qui ne fonctionnent que chez Kimi). Crée un `.env` neuf, minimal :

```bash
cat > /opt/anotrack/.env <<'EOF'
DATABASE_URL=mysql://anotrack:« MOT_DE_PASSE_DB_FORT »@127.0.0.1:3306/anotrack
PORT=3000
NODE_ENV=production
EOF
chmod 600 /opt/anotrack/.env
```

⚠️ Pas de paramètre `?ssl=...` dans l'URL : MySQL est local, pas de TLS.
⚠️ Si le mot de passe contient des caractères spéciaux (`@`, `#`, `/`, `%`…), encode-les en percent-encoding dans l'URL (ex. `@` → `%40`).

---

## 6. Build et premier démarrage

```bash
cd /opt/anotrack
npm ci            # installe les dépendances (quelques minutes sur un petit VPS)
npm run build     # compile le frontend (dist/public) + le backend (dist/boot.js)

# Test manuel : le serveur doit répondre, puis Ctrl+C
npm start &
sleep 5
curl -s http://127.0.0.1:3000/api/trpc/ping
# → {"result":{"data":{"json":{"ok":true,"ts":...}}}}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
# → 200
kill %1
```

Au premier appel à une route de données, l'application crée ses tables. Vérification :

```bash
npm start & sleep 5
curl -s http://127.0.0.1:3000/api/trpc/ano.listExams > /dev/null
mysql -u root anotrack -e "SHOW TABLES;"
# → students, exams, submissions, settings
kill %1
```

---

## 7. Service systemd (démarrage automatique)

```bash
cat > /etc/systemd/system/anotrack.service <<'EOF'
[Unit]
Description=AnoTrack - classement anonyme
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=anotrack
Group=anotrack
WorkingDirectory=/opt/anotrack
EnvironmentFile=/opt/anotrack/.env
ExecStart=/usr/bin/node dist/boot.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

chown -R anotrack:anotrack /opt/anotrack
systemctl daemon-reload
systemctl enable --now anotrack
systemctl status anotrack --no-pager
journalctl -u anotrack -n 20 --no-pager
```

---

## 8. Reverse proxy nginx + HTTPS

```bash
cat > /etc/nginx/sites-available/anotrack <<'EOF'
server {
    listen 80;
    server_name « DOMAIN »;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/anotrack /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# HTTPS (le domaine doit déjà pointer vers le VPS)
certbot --nginx -d « DOMAIN » --redirect -m « EMAIL_ADMIN » --agree-tos -n
```

---

## 9. Vérifications finales

```bash
curl -s https://« DOMAIN »/api/trpc/ping
# → {"result":{"data":{"json":{"ok":true,...}}}}

curl -s -o /dev/null -w '%{http_code}\n' https://« DOMAIN »/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: text/html' https://« DOMAIN »/admin
# → 200 et 200 (fallback SPA)
```

Puis dans un navigateur, sur `https://« DOMAIN »/admin` :
1. **Créer le mot de passe admin** (première visite).
2. Section « La classe » : coller la liste des élèves (un nom par ligne), enregistrer.
3. Section « Nouveau DS » : créer le premier DS.
4. Partager `https://« DOMAIN »` à la classe.

---

## 10. Exploitation courante

**Mise à jour du code** (nouvelle version du zip) :

```bash
systemctl stop anotrack
cd /opt/anotrack
unzip -o /tmp/anotrack-site-nouveau.zip   # écrase les sources ; NE PAS toucher à .env
npm ci
npm run build
systemctl start anotrack
```

**Sauvegarde de la base** (les notes !) — cron quotidien :

```bash
mkdir -p /var/backups/anotrack
cat > /etc/cron.daily/backup-anotrack <<'EOF'
#!/bin/bash
mysqldump -u root anotrack | gzip > /var/backups/anotrack/anotrack-$(date +\%F).sql.gz
find /var/backups/anotrack -name '*.sql.gz' -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/backup-anotrack
```

**Logs** : `journalctl -u anotrack -f`

**Réinitialisation complète** (⚠️ destructeur — supprime toutes les notes) :

```bash
mysql -u root anotrack -e "DROP TABLE submissions, exams, students, settings;"
systemctl restart anotrack   # les tables seront recréées vides
```

---

## 11. Dépannage

| Symptôme | Diagnostic | Solution |
|---|---|---|
| `curl :3000` refuse | `systemctl status anotrack` | lire `journalctl -u anotrack -n 50` |
| Erreur `ECONNREFUSED 127.0.0.1:3306` | MySQL arrêté | `systemctl start mysql` |
| Erreur `Access denied for user` | mauvais mot de passe dans `DATABASE_URL` | corriger `.env` (attention au percent-encoding), `systemctl restart anotrack` |
| 502 via nginx | Node arrêté ou port différent | vérifier `PORT` dans `.env` = `proxy_pass` dans nginx |
| Page blanche sur `/admin` | testé sans en-tête navigateur | normal avec `curl` ; dans un vrai navigateur ça fonctionne |
| Tables absentes | `mysql -e "SHOW TABLES;" anotrack` vide | appeler une fois `curl https://« DOMAIN »/api/trpc/ano.listExams`, les tables se créent |

---

## 12. Ce qui ne migre PAS depuis la version hébergée par Kimi

- La base de données Kimi (notes déjà saisies le cas échéant) n'est **pas accessible de l'extérieur**. Si des données existent déjà sur la version Kimi, demander d'abord à l'auteur du site la fonctionnalité d'export/import avant de basculer.
- Le mot de passe admin et la liste de classe sont à recréer (2 minutes, étape 9).
