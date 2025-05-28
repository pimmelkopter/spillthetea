# 💬 Chat Share

Eine moderne Web-App zum Teilen von Konversationen im authentischen Chat-Look, inspiriert von MicroBin's Sharing-Features.

## ✨ Features

- **📱 Mobile-First Design** - Responsive Layout für alle Geräte
- **💬 Authentische Chat-Bubbles** - Modernes Messenger-Design
- **👥 Personen-Management** - Editierbare Gesprächspartner
- **🎨 Highlight-System** - Text markieren und Kreise setzen
- **📸 Bild-Upload** - Bilder in Nachrichten einbetten
- **🔗 Smart Sharing** - Animal-Namen URLs wie bei MicroBin
- **⏰ Expiry-Optionen** - Automatisches Ablaufen nach Zeit oder Views
- **🔒 Passwort-Schutz** - Sichere Chat-Links
- **🌐 Multi-Chat Support** - Mehrere Gespräche in einem Link

## 🚀 Schnellstart

### Mit Docker (Empfohlen)

```bash
# Repository klonen
git clone <repository-url>
cd chat-share

# Mit Docker Compose starten
docker-compose up -d

# App ist verfügbar unter http://localhost:3000
```

### Manuell installieren

```bash
# Dependencies installieren
npm install

# Datenbank einrichten
npm run setup

# Frontend-Dateien in public/ verschieben
mv index.html public/
mv chat.html public/

# Server starten
npm start

# Oder für Development
npm run dev
```

## 📁 Projektstruktur

```
chat-share/
├── server.js              # Haupt-Server
├── setup.js               # Datenbank-Setup
├── package.json           # Dependencies
├── .env                   # Konfiguration
├── Dockerfile             # Container-Config
├── docker-compose.yml     # Full-Stack Deployment
├── public/
│   ├── index.html         # Haupt-App
│   └── chat.html          # Chat-Viewer
├── uploads/               # Hochgeladene Dateien
└── data/                  # SQLite-Datenbank
```

## 🔧 Konfiguration

### Umgebungsvariablen (.env)

```bash
# Server
PORT=3000
NODE_ENV=production

# Sicherheit
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=10485760    # 10MB
UPLOAD_DIR=uploads

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 Minuten
RATE_LIMIT_MAX=100        # Max Requests
```

### Erweiterte Konfiguration

```bash
# PostgreSQL statt SQLite
DATABASE_URL=postgres://user:pass@localhost:5432/chatshare

# AWS S3 für File Storage
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket

# Redis für Sessions
REDIS_URL=redis://localhost:6379
```

## 🎯 Verwendung

### Chat erstellen

1. **Titel eingeben** (optional)
2. **Personen verwalten** - "Du" umbenennen, neue Personen hinzufügen
3. **Namen anzeigen** - Toggle für Sender-Namen in Bubbles
4. **Nachrichten hinzufügen** - Text, Bilder, Zeit/Datum
5. **Highlights setzen** - Text markieren, Kreise platzieren
6. **Weitere Chats** - Mehrere Gespräche untereinander

### Chat teilen

1. **"Spill the Tea"** klicken
2. **Optionen wählen:**
   - Verfallszeit (1h, 1 Tag, 1 Woche, 1 Monat)
   - Max. Views (1, 5, 10, 50, unbegrenzt)
   - Passwort (optional)
3. **Link erstellen** und kopieren

### Animal-Namen URLs

Chats bekommen automatisch URLs wie:
- `/chat/fox-dog-cat`
- `/chat/lion-bear-wolf`
- `/chat/owl-duck-frog`

## 🔒 Sicherheit

- **Password Hashing** mit bcrypt (12 rounds)
- **Rate Limiting** - Schutz vor Spam
- **File Upload Validation** - Nur Bilder, max 10MB
- **SQL Injection Protection** - Prepared Statements
- **XSS Protection** - Input Sanitization
- **HTTPS Ready** - SSL/TLS Support

## 📊 API Endpoints

```bash
# File Upload
POST /api/upload
Content-Type: multipart/form-data
Body: image file

# Chat teilen
POST /api/share
Content-Type: application/json
Body: { chats, persons, highlights, expiry, views, password }

# Chat abrufen
GET /api/chat/:animalUrl?password=xxx

# Health Check
GET /health
```

## 🐳 Docker Deployment

### Einfaches Setup
```bash
docker-compose up -d
```

### Mit Nginx + SSL
```bash
docker-compose --profile nginx up -d
```

### Mit PostgreSQL
```bash
docker-compose --profile postgres up -d
```

### Full Stack (Nginx + PostgreSQL + Redis)
```bash
docker-compose --profile nginx --profile postgres --profile redis up -d
```

## 🔧 Wartung

### Expired Chats löschen
Chats werden automatisch alle Stunde bereinigt. Manuell:

```sql
UPDATE chats SET is_active = 0 
WHERE expires_at IS NOT NULL 
AND expires_at < datetime('now');
```

### Logs anzeigen
```bash
# Docker
docker-compose logs -f chatshare

# Standard
npm start 2>&1 | tee server.log
```

### Backup erstellen
```bash
# SQLite Backup
cp chatshare.db chatshare_backup_$(date +%Y%m%d).db

# Files Backup  
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## 🚀 Production Deployment

### Systemd Service
```ini
[Unit]
Description=Chat Share App
After=network.target

[Service]
Type=simple
User=chatshare
WorkingDirectory=/opt/chatshare
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Nginx Config
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /uploads/ {
        alias /opt/chatshare/uploads/;
        expires 1y;
    }
}
```

## 🐛 Troubleshooting

### SQLite Locked Error
```bash
# Check für lange Queries
sudo fuser chatshare.db
kill -9 <PID>
```

### File Upload Fehler
```bash
# Permissions prüfen
ls -la uploads/
chmod 755 uploads/
chown -R node:node uploads/

# Disk Space prüfen
df -h
```

### Port bereits belegt
```bash
# Port 3000 checken
lsof -i :3000
kill -9 <PID>

# Anderen Port verwenden
PORT=3001 npm start
```

### Memory Issues
```bash
# Node.js Memory erhöhen
node --max-old-space-size=4096 server.js

# Docker Memory Limit
docker run -m 512m chat-share
```

## 🔄 Updates & Migration

### Version Update
```bash
# Code aktualisieren
git pull origin main
npm install

# Datenbank migrieren (falls nötig)
npm run migrate

# Server neustarten
npm restart
```

### Datenbank Migration
```sql
-- Beispiel: Neue Spalte hinzufügen
ALTER TABLE chats ADD COLUMN view_count_limit INTEGER DEFAULT -1;

-- Index erstellen
CREATE INDEX idx_new_column ON chats (new_column);
```

## 📈 Monitoring & Analytics

### Performance Monitoring
```javascript
// server.js - Response Time Logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${duration}ms`);
    });
    next();
});
```

### Health Checks
```bash
# Basic Health Check
curl http://localhost:3000/health

# Detailed Check
curl -s http://localhost:3000/health | jq
```

### Database Stats
```sql
-- Chat Statistics
SELECT 
    COUNT(*) as total_chats,
    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_chats,
    COUNT(CASE WHEN expires_at IS NOT NULL THEN 1 END) as expiring_chats,
    AVG(current_views) as avg_views
FROM chats;

-- Popular Animal URLs
SELECT animal_url, current_views 
FROM chats 
WHERE is_active = 1 
ORDER BY current_views DESC 
LIMIT 10;
```

## 🎨 Customization

### Theme Anpassen
```css
/* public/custom.css */
:root {
    --primary-color: #your-color;
    --secondary-color: #your-color;
    --background-gradient: linear-gradient(135deg, #color1, #color2);
}
```

### Animal Names erweitern
```javascript
// server.js - Eigene Tiernamen
const CUSTOM_ANIMALS = [
    'dragon', 'phoenix', 'unicorn', 'griffin',
    // ... mehr Namen
];
```

### Custom Features hinzufügen
```javascript
// Beispiel: Chat Reactions
app.post('/api/chat/:id/react', (req, res) => {
    const { reaction } = req.body;
    // Reaction Logic hier
});
```

## 🤝 Contributing

### Development Setup
```bash
# Repository forken
git clone https://github.com/your-username/chat-share
cd chat-share

# Development Dependencies
npm install --include=dev

# Development Server mit Hot Reload
npm run dev

# Tests ausführen
npm test
```

### Code Style
- **ESLint** für JavaScript
- **Prettier** für Formatting
- **Conventional Commits** für Git Messages

### Pull Requests
1. Feature Branch erstellen: `git checkout -b feature/new-feature`
2. Changes committen: `git commit -m "feat: add new feature"`
3. Tests hinzufügen und ausführen
4. Pull Request erstellen

## 📜 Lizenz

Dieses Projekt steht unter der **BSD 3-Clause License** - genau wie MicroBin.

```
Copyright (c) 2024, Chat Share Team
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.
```

## 🙏 Credits

- **MicroBin** - Inspiration für Sharing-Features und Animal-Namen URLs
- **Water.css** - Minimales CSS Framework
- **SQLite** - Embedded Database
- **Express.js** - Web Framework
- **Multer** - File Upload Handling

## 📞 Support

### Community
- **GitHub Issues** - Bug Reports & Feature Requests
- **Discussions** - Fragen & Ideen
- **Wiki** - Erweiterte Dokumentation

### Professional Support
Für Enterprise-Features und professionellen Support:
- E-Mail: support@chat-share.app
- Slack: #chat-share-support

---

## 🚀 Quick Commands Cheat Sheet

```bash
# Setup
npm install && npm run setup

# Development
npm run dev

# Production
NODE_ENV=production npm start

# Docker
docker-compose up -d

# Health Check
curl localhost:3000/health

# Logs
docker-compose logs -f

# Backup
cp chatshare.db backup.db

# Clean expired chats
node -e "require('./server.js').cleanupExpired()"
```

**🎉 Viel Spaß beim Chatten und Teilen!**