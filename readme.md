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
3. **Link erstellen** - bekommt URL wie `/chat/fox-dog-cat`
4. **Edit-Link** für spätere Bearbeitung nutzen

### Features
- **Theme-Wechsel** - Gradient ↔ Monochrom  
- **Namen anzeigen** - Pro Chat konfigurierbar
- **Nachrichten editieren** - ↑↓ Pfeile zum Verschieben, ✏️ zum Bearbeiten
- **New Tea** - Neuen Chat starten

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

## 💾 Datenbank

- **SQLite** - Einfach und wartungsarm
- **Persistent Storage** - Daten in `./data/` Volume
- **Auto-Migration** - Schema-Updates automatisch
- **Backup-freundlich** - Einfache `.db` Datei

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

## 📜 Lizenz

BSD 3-Clause License - Siehe [LICENSE](LICENSE) Datei.

## 🤝 Contributing

Issues und Pull Requests sind willkommen!

1. Fork das Repository
2. Feature Branch erstellen  
3. Changes committen
4. Pull Request erstellen

---

**Made with ☕ by the Spill The Tea Team**
just kidding - i'm alone vibecoding instead of doing usefull things with my life