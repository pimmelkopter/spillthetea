# ☕ Spill The Tea

Eine moderne Chat-Sharing Web-App zum Teilen von echten oder fiktiven Konversationen im authentischen Messenger-Look.

## ✨ Features

- **📱 Mobile-First Design** - Responsive für alle Geräte
- **💬 Authentische Chat-Bubbles** - Wie in echten Messengern  
- **🎨 Themes** - Gradient oder Monochrom
- **👥 Multi-Chat Support** - Mehrere Gespräche in einem Link
- **✏️ Live-Editing** - Nachrichten verschieben und bearbeiten
- **📸 Bild-Upload** - Bilder in Nachrichten
- **🔗 Smart Sharing** - Animal-Namen URLs wie `fox-dog-cat`
- **⏰ Auto-Expiry** - Ablauf nach Zeit oder Views  
- **🔒 Passwort-Schutz** - Sichere Links
- **✏️ Edit-Links** - Geteilte Chats nachträglich bearbeiten
- **🔄 Ongoing Chats** - Kontinuierlich erweiterbare Chats
- **💬 Kommentar-System** - Kommentare zu einzelnen Nachrichten
- **🔔 Push-Notifications** - Web-Push für neue Inhalte
- **❓ FAQ Modal** - Integrierte Hilfe und Erklärungen

## 🚀 Quick Start

### Mit Docker (Empfohlen)

```bash
git clone <repository-url>
cd spillthetea
docker-compose up -d
```

App läuft auf `http://localhost:3000`

### Manuell

```bash
npm install
npm run setup  # Erstellt Datenbank
npm start
```

## 📁 Projekt-Struktur

```
spillthetea/
├── server.js              # Node.js Server
├── package.json           # Dependencies  
├── docker-compose.yml     # Container Setup
├── public/
│   ├── index.html         # Editor
│   └── chat.html          # Chat Viewer
├── data/                  # SQLite Database (persistent)
└── uploads/               # Uploaded Files (persistent)
```

## 🔧 Konfiguration

### Environment Variablen (.env)

```bash
PORT=3000
NODE_ENV=production
DATABASE_PATH=./data/chatshare.db
MAX_FILE_SIZE=10485760

# Push Notifications (optional)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=your_email@domain.com
```

### VAPID Keys für Push-Notifications generieren

```bash
npm install -g web-push
web-push generate-vapid-keys
```

### Eigene Domain

```yaml
# docker-compose.yml
environment:
  - VIRTUAL_HOST=your-domain.com
  - LETSENCRYPT_HOST=your-domain.com
  - LETSENCRYPT_EMAIL=you@domain.com
```

## 🎯 Verwendung

### Chat erstellen
1. **Titel** eingeben (optional)
2. **Personen** hinzufügen/bearbeiten  
3. **Nachrichten** schreiben (mit Bildern, Zeit, Datum)
4. **Kommentare** für Notizen hinzufügen
5. **Add Chat** für weitere Gespräche

### Chat teilen  
1. **"Spill the Tea"** klicken
2. **Optionen** wählen (Ablaufzeit, Views, Passwort)
3. **"Der Tea geht vielleicht weiter?"** für ongoing Chats aktivieren
4. **Link erstellen** - bekommt URL wie `/chat/fox-dog-cat`
5. **Edit-Link** für spätere Bearbeitung nutzen

### Ongoing Chats
- **Kontinuierliche Bearbeitung** ohne neuen Link
- **Edit-Link läuft nach 3 Monaten ab** (statt 2 Tage)
- **Update-Funktion** für Ablaufzeit und View-Limits
- **Push-Notifications** bei neuen Nachrichten

### Kommentar-System
- **Kommentar-Icons** erscheinen bei Hover über Nachrichten
- **Badge zeigt Anzahl** vorhandener Kommentare
- **Modal-Fenster** zum Lesen und Schreiben von Kommentaren
- **Anonyme Kommentare** (Namen nur wenn selbst geschrieben)

### Push-Notifications
- **"Tea abonnieren"** Button im Chat-Viewer
- **Browser-Berechtigung** wird automatisch angefragt
- **Benachrichtigungen bei:**
  - Neuen Kommentaren
  - Neuen Nachrichten in ongoing Chats
- **Klick auf Notification** führt direkt zum Chat

### Features
- **Theme-Wechsel** - Gradient ↔ Monochrom  
- **Namen anzeigen** - Pro Chat konfigurierbar
- **Nachrichten editieren** - ↑↓ Pfeile zum Verschieben, ✏️ zum Bearbeiten
- **New Tea** - Neuen Chat starten
- **FAQ** - Integrierte Hilfe

## 🐳 Production Setup

### Standard Deployment
```bash
git clone <repo>
cd spillthetea
docker-compose up -d
```

### Mit nginx-proxy
```bash
# Für nginx-proxy + Let's Encrypt Setup
docker-compose -f docker-compose.nginx.yml up -d
```

### Push-Notifications aktivieren
```bash
# VAPID Keys generieren
web-push generate-vapid-keys

# In .env eintragen
echo "VAPID_PUBLIC_KEY=BM..." >> .env
echo "VAPID_PRIVATE_KEY=..." >> .env
echo "VAPID_EMAIL=admin@yourdomain.com" >> .env

# Container neu starten
docker-compose restart
```

### Daten-Backup
```bash
# Backup erstellen
tar -czf backup.tar.gz data/ uploads/

# Wiederherstellen  
tar -xzf backup.tar.gz
```

### Update
```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

## 🔒 Security Features

- **Password Hashing** mit bcrypt
- **Rate Limiting** - Schutz vor Spam
- **File Upload Validation** - Nur Bilder, max 10MB
- **Auto-Cleanup** - Expired Chats werden automatisch gelöscht
- **SQL Injection Protection** - Prepared Statements
- **Input Sanitization** - Alle Benutzereingaben werden bereinigt

## 💾 Datenbank

- **SQLite** - Einfach und wartungsarm
- **Persistent Storage** - Daten in `./data/` Volume
- **Auto-Migration** - Schema-Updates automatisch
- **Backup-freundlich** - Einfache `.db` Datei
- **Tabellen:**
  - `chats` - Chat-Daten und Metainformationen
  - `files` - Hochgeladene Bilder
  - `comments` - Kommentare zu Nachrichten
  - `push_subscriptions` - Push-Notification Abonnements

## 🔔 Push-Notifications

### Setup
1. **VAPID Keys generieren** mit web-push
2. **Environment Variables** setzen
3. **HTTPS erforderlich** (außer localhost)

### Funktionsweise
- **Service Worker** wird automatisch registriert
- **Subscription** wird an Server gesendet
- **Notifications** bei neuen Kommentaren/Nachrichten
- **Click-to-Open** führt direkt zum Chat

## 🐛 Troubleshooting

### Container startet nicht
```bash
# Logs prüfen
docker-compose logs spillthetea

# Ports prüfen
netstat -tulpn | grep :3000
```

### Datenbank Probleme
```bash
# Permissions setzen
sudo chown -R 1000:1000 data/

# Neue Datenbank
rm data/chatshare.db
docker-compose restart
```

### File Upload Fehler
```bash
# Upload-Ordner erstellen
mkdir -p uploads
chmod 755 uploads/
```

### Push-Notifications funktionieren nicht
```bash
# VAPID Keys prüfen
echo $VAPID_PUBLIC_KEY

# HTTPS erforderlich (außer localhost)
# Browser-Permissions prüfen
# Service Worker Console checken
```

### Kommentare laden nicht
```bash
# API-Endpunkt testen
curl -X GET "http://localhost:3000/api/comments/your-chat-url/message-id"

# Datenbank prüfen
sqlite3 data/chatshare.db "SELECT * FROM comments LIMIT 5;"
```

## 📜 API Endpunkte

### Chat Management
- `POST /api/share` - Chat erstellen/teilen
- `GET /api/chat/:url` - Chat laden
- `GET /api/edit/:url` - Edit-Chat laden
- `PUT /api/update/:url` - Ongoing Chat aktualisieren

### Comments
- `GET /api/comments/:chatUrl/:messageId` - Kommentare laden
- `POST /api/comments/:chatUrl/:messageId` - Kommentar hinzufügen

### Push Notifications
- `GET /api/vapid-public-key` - VAPID Public Key
- `POST /api/subscribe/:chatUrl` - Push-Subscription

### File Upload
- `POST /api/upload` - Bild hochladen

## 📜 Lizenz

BSD 3-Clause License - Siehe [LICENSE](LICENSE) Datei.

## 🤝 Contributing

Issues und Pull Requests sind willkommen!

1. Fork das Repository
2. Feature Branch erstellen  
3. Changes committen
4. Pull Request erstellen

## 🔄 Changelog

### v2.0.0
- ✨ Kommentar-System für Nachrichten
- 🔔 Push-Notifications mit Web-Push
- 🔄 Ongoing Chat Funktion
- ❓ FAQ Modal integriert
- 🎨 UI/UX Verbesserungen
- 🔒 Erweiterte Sicherheitsfeatures

### v1.0.0
- 🎉 Initial Release
- 💬 Chat-Sharing Grundfunktionen
- 🔗 Animal-URL System
- 🎨 Theme Support
- 📱 Mobile-First Design

---

**Made with ☕ by the Spill The Tea Team**

*just kidding - i'm alone vibecoding instead of doing usefull things with my life*