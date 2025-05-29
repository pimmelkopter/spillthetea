const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for nginx-proxy
app.set('trust proxy', true);

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_EMAIL || 'admin@spillthetea.app'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Animal names array (same as MicroBin)
const ANIMAL_NAMES = [
    'ant', 'bat', 'bee', 'bug', 'cat', 'cow', 'dog', 'eel', 'elk', 'emu',
    'fly', 'fox', 'gnu', 'hen', 'hog', 'jay', 'owl', 'pig', 'ram', 'rat',
    'yak', 'ape', 'bear', 'bird', 'boar', 'buck', 'bull', 'calf', 'chow',
    'crab', 'crow', 'deer', 'dove', 'duck', 'fawn', 'fish', 'frog', 'goat',
    'hawk', 'ibis', 'joey', 'kiwi', 'lamb', 'lion', 'lark', 'lynx', 'mole',
    'moth', 'newt', 'orca', 'pika', 'pony', 'puma', 'seal', 'slug', 'swan',
    'toad', 'trout', 'wasp', 'wolf', 'worm', 'wren'
];

// Sanitization options
const sanitizeOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
};

// Sanitize function
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeHtml(input, sanitizeOptions);
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for demo
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Database setup
const dbPath = process.env.DATABASE_PATH || './data/chatshare.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(async () => {
    // Chats table
    db.run(`CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        animal_url TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        password_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        max_views INTEGER DEFAULT -1,
        current_views INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        is_edit_link BOOLEAN DEFAULT 0,
        is_ongoing BOOLEAN DEFAULT 0,
        theme TEXT DEFAULT 'gradient',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        chat_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id)
    )`);

    // Comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        chat_url TEXT NOT NULL,
        message_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_url) REFERENCES chats (animal_url)
    )`);

    // Push subscriptions table
    db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        chat_url TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_url) REFERENCES chats (animal_url)
    )`);

    // Index for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_animal_url ON chats (animal_url)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_expires_at ON chats (expires_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_is_edit_link ON chats (is_edit_link)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_chat ON comments (chat_url)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_message ON comments (message_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_chat ON push_subscriptions (chat_url)`);

await initializeDatabase();
});

// Database migration and initialization (FIXED)
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Checking database schema...');
        
        // 1. Check existing columns and add missing ones
        db.all("PRAGMA table_info(chats)", (err, columns) => {
            if (err) {
                console.error('❌ Error checking schema:', err);
                return reject(err);
            }
            
            const existingColumns = columns.map(col => col.name);
            const requiredColumns = [
                { 
                    name: 'is_ongoing', 
                    sql: 'ALTER TABLE chats ADD COLUMN is_ongoing BOOLEAN DEFAULT 0' 
                },
                { 
                    name: 'last_updated', 
                    sql: 'ALTER TABLE chats ADD COLUMN last_updated DATETIME' // Kein Default!
                }
            ];
            
            // Add missing columns
            let migrationsNeeded = requiredColumns.filter(col => !existingColumns.includes(col.name));
            
            if (migrationsNeeded.length > 0) {
                console.log(`📊 Adding ${migrationsNeeded.length} missing columns...`);
                
                let completed = 0;
                migrationsNeeded.forEach(migration => {
                    db.run(migration.sql, (err) => {
                        if (err) {
                            console.error(`❌ Error adding column ${migration.name}:`, err);
                            return reject(err);
                        }
                        
                        console.log(`✅ Added column: ${migration.name}`);
                        completed++;
                        
                        if (completed === migrationsNeeded.length) {
                            // Nach dem Hinzufügen der Spalten, setze Defaults
                            updateMissingDefaults();
                        }
                    });
                });
            } else {
                console.log('✅ Database schema is up to date');
                proceedWithScan();
            }
        });
        
        function updateMissingDefaults() {
            console.log('🔄 Setting default values for new columns...');
            
            // Setze last_updated für bestehende Chats
            db.run(
                `UPDATE chats SET last_updated = created_at WHERE last_updated IS NULL`,
                function(err) {
                    if (err) {
                        console.error('❌ Error setting default values:', err);
                        return reject(err);
                    }
                    
                    if (this.changes > 0) {
                        console.log(`✅ Updated ${this.changes} rows with default timestamps`);
                    }
                    
                    proceedWithScan();
                }
            );
        }
        
        function proceedWithScan() {
            console.log('🔍 Scanning database...');
            
            // 2. Cleanup expired chats immediately
            db.run(
                `UPDATE chats SET is_active = 0 WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`,
                function(err) {
                    if (err) {
                        console.error('❌ Error cleaning up expired chats:', err);
                        return reject(err);
                    }
                    
                    if (this.changes > 0) {
                        console.log(`🧹 Cleaned up ${this.changes} expired chats`);
                    }
                    
                    // 3. Get database statistics
                    db.all(`
                        SELECT 
                            COUNT(*) as total_chats,
                            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_chats,
                            COUNT(CASE WHEN is_edit_link = 1 THEN 1 END) as edit_links,
                            COUNT(CASE WHEN COALESCE(is_ongoing, 0) = 1 THEN 1 END) as ongoing_chats,
                            COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at > datetime('now') THEN 1 END) as expiring_chats
                        FROM chats
                    `, (err, rows) => {
                        if (err) {
                            console.error('❌ Error getting database stats:', err);
                            return reject(err);
                        }
                        
                        const stats = rows[0];
                        console.log('📊 Database Statistics:');
                        console.log(`   Total chats: ${stats.total_chats}`);
                        console.log(`   Active chats: ${stats.active_chats}`);
                        console.log(`   Edit links: ${stats.edit_links}`);
                        console.log(`   Ongoing chats: ${stats.ongoing_chats}`);
                        console.log(`   With expiry: ${stats.expiring_chats}`);
                        
                        // 4. Get comment and subscription statistics
                        getAdditionalStats();
                    });
                }
            );
        }
        
        function getAdditionalStats() {
            // Comments
            db.get(`SELECT COUNT(*) as total_comments FROM comments`, (err, row) => {
                const comments = err ? 0 : row.total_comments;
                console.log(`   Total comments: ${comments}`);
                
                // Push subscriptions
                db.get(`SELECT COUNT(*) as total_subscriptions FROM push_subscriptions`, (err, row) => {
                    const subscriptions = err ? 0 : row.total_subscriptions;
                    console.log(`   Push subscriptions: ${subscriptions}`);
                    console.log('✅ Database scan completed\n');
                    resolve();
                });
            });
        }
    });
}

// Utility functions
function generateAnimalUrl() {
    const animals = [];
    for (let i = 0; i < 3; i++) {
        animals.push(ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)]);
    }
    return animals.join('-');
}

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function calculateExpiryDate(expiry, isOngoing = false) {
    if (expiry === 'never') return null;
    if (isOngoing && expiry === '2days') {
        // Ongoing edit links get 3 months instead of 2 days
        const now = new Date();
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    }
    
    const now = new Date();
    switch (expiry) {
        case '1hour':
            return new Date(now.getTime() + 60 * 60 * 1000);
        case '1day':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case '1week':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case '1month':
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        case '2days':
            return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        default:
            return null;
    }
}

function parseMaxViews(views) {
    if (views === 'unlimited') return -1;
    return parseInt(views) || -1;
}

async function hashPassword(password) {
    if (!password) return null;
    return await bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
    if (!hash) return !password; // No password required
    if (!password) return false;
    return await bcrypt.compare(password, hash);
}

function isExpired(chat) {
    if (!chat.expires_at) return false;
    return new Date() > new Date(chat.expires_at);
}

function isViewLimitExceeded(chat) {
    if (chat.max_views === -1) return false;
    return chat.current_views >= chat.max_views;
}

// Add message IDs to existing chats
function ensureMessageIds(chatData) {
    if (!chatData.chats) return chatData;
    
    chatData.chats.forEach(chat => {
        if (chat.messages) {
            chat.messages.forEach(message => {
                if (!message.id) {
                    message.id = uuidv4();
                }
            });
        }
    });
    
    return chatData;
}

// Send push notification
async function sendPushNotification(chatUrl, message, type = 'comment') {
    if (!process.env.VAPID_PUBLIC_KEY) return;

    try {
        const subscriptions = await new Promise((resolve, reject) => {
            db.all(
                'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE chat_url = ?',
                [chatUrl],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        const payload = JSON.stringify({
            title: 'New Tea ☕',
            body: type === 'comment' ? 
                'Es gibt einen neuen Kommentar in deinem Chat' : 
                'Es gibt neue Nachrichten in deinem abonnierten Chat',
            url: `/chat/${chatUrl}`,
            icon: '/favicon.ico'
        });

        const pushPromises = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            
            return webpush.sendNotification(pushSubscription, payload)
                .catch(err => {
                    if (err.statusCode === 410) {
                        // Subscription expired, remove it
                        db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                    }
                    console.error('Push notification error:', err);
                });
        });

        await Promise.all(pushPromises);
        console.log(`Sent ${subscriptions.length} push notifications for ${chatUrl}`);
    } catch (error) {
        console.error('Error sending push notifications:', error);
    }
}

// Cleanup expired chats (run every hour)
setInterval(() => {
    db.run(
        `UPDATE chats SET is_active = 0 WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`,
        function(err) {
            if (err) {
                console.error('Cleanup error:', err);
            } else if (this.changes > 0) {
                console.log(`🧹 Hourly cleanup: ${this.changes} chats expired`);
            }
        }
    );
}, 60 * 60 * 1000);

// API Routes

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'), (err) => {
        if (err) {
            // Fallback wenn favicon nicht existiert
            res.status(404).send('Favicon not found');
        }
    });
});

// Get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// Subscribe to push notifications
app.post('/api/subscribe/:chatUrl', (req, res) => {
    try {
        const { chatUrl } = req.params;
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }

        const subscriptionId = uuidv4();
        
        db.run(
            `INSERT OR REPLACE INTO push_subscriptions (id, chat_url, endpoint, p256dh, auth) 
             VALUES (?, ?, ?, ?, ?)`,
            [subscriptionId, chatUrl, endpoint, keys.p256dh, keys.auth],
            function(err) {
                if (err) {
                    console.error('Subscription error:', err);
                    return res.status(500).json({ error: 'Failed to save subscription' });
                }

                res.json({ success: true, id: subscriptionId });
            }
        );
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// Get comments for a message
app.get('/api/comments/:chatUrl/:messageId', (req, res) => {
    try {
        const { chatUrl, messageId } = req.params;

        db.all(
            `SELECT id, text, created_at FROM comments 
             WHERE chat_url = ? AND message_id = ? 
             ORDER BY created_at ASC`,
            [chatUrl, messageId],
            (err, rows) => {
                if (err) {
                    console.error('Get comments error:', err);
                    return res.status(500).json({ error: 'Failed to get comments' });
                }

                res.json({ comments: rows || [] });
            }
        );
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Add comment to a message
app.post('/api/comments/:chatUrl/:messageId', (req, res) => {
    try {
        const { chatUrl, messageId } = req.params;
        const { text } = req.body;

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const cleanText = sanitizeInput(text.trim());
        const commentId = uuidv4();

        db.run(
            `INSERT INTO comments (id, chat_url, message_id, text) 
             VALUES (?, ?, ?, ?)`,
            [commentId, chatUrl, messageId, cleanText],
            async function(err) {
                if (err) {
                    console.error('Add comment error:', err);
                    return res.status(500).json({ error: 'Failed to add comment' });
                }

                // Send push notification
                await sendPushNotification(chatUrl, cleanText, 'comment');

                res.json({ success: true, id: commentId });
            }
        );
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Upload file
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileData = {
            id: uuidv4(),
            filename: req.file.filename,
            original_name: req.file.originalname,
            mime_type: req.file.mimetype,
            size: req.file.size
        };

        res.json({
            success: true,
            file: fileData,
            url: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Create/Share chat
app.post('/api/share', async (req, res) => {
    try {
        let { chats, expiry, views, password, theme, isEditLink, customUrl, isOngoing } = req.body;

        if (!chats || !Array.isArray(chats)) {
            return res.status(400).json({ error: 'Invalid chat data' });
        }

        // Sanitize all text inputs
        chats = chats.map(chat => ({
            ...chat,
            title: sanitizeInput(chat.title || ''),
            persons: Object.fromEntries(
                Object.entries(chat.persons || {}).map(([key, value]) => [
                    sanitizeInput(key),
                    sanitizeInput(value)
                ])
            ),
            messages: (chat.messages || []).map(message => ({
                ...message,
                id: message.id || uuidv4(),
                text: sanitizeInput(message.text || ''),
                sender: sanitizeInput(message.sender || ''),
                time: sanitizeInput(message.time || ''),
                date: sanitizeInput(message.date || '')
            }))
        }));

        const id = uuidv4();
        let animalUrl;

        // Generate unique URL
        const findUniqueUrl = async () => {
            // Use custom URL for edit links
            if (customUrl) {
                const existingChat = await new Promise((resolve, reject) => {
                    db.get('SELECT id FROM chats WHERE animal_url = ?', [customUrl], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                
                if (existingChat) {
                    throw new Error('Custom URL already exists');
                }
                return customUrl;
            }

            // Generate animal URL for regular chats
            const maxAttempts = 50;
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                const testUrl = generateAnimalUrl();
            
                try {
            const existingChat = await new Promise((resolve, reject) => {
                        db.get('SELECT id FROM chats WHERE animal_url = ?', [testUrl], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
                    if (!existingChat) {
                        console.log(`Generated unique URL: ${testUrl} (attempt ${attempts + 1})`);
                        return testUrl;
                    }
                    
                    console.log(`URL collision: ${testUrl} (attempt ${attempts + 1})`);
                } catch (dbError) {
                    console.error('Database error checking URL:', dbError);
                    continue;
                }
            }
            
            throw new Error('Could not generate unique URL after maximum attempts');
        };

        try {
            animalUrl = await findUniqueUrl();
        } catch (error) {
            console.error('URL generation failed:', error);
            return res.status(500).json({ error: 'Could not generate unique URL. Please try again.' });
        }

        const chatData = {
            chats,
            created: new Date().toISOString(),
            theme: theme || 'gradient'
        };

        const expiresAt = calculateExpiryDate(expiry, isOngoing);
        const maxViews = parseMaxViews(views);
        const passwordHash = await hashPassword(password);

        db.run(
            `INSERT INTO chats (id, animal_url, data, password_hash, expires_at, max_views, is_edit_link, is_ongoing, theme) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, animalUrl, JSON.stringify(chatData), passwordHash, expiresAt, maxViews, isEditLink ? 1 : 0, isOngoing ? 1 : 0, theme || 'gradient'],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(500).json({ error: 'URL collision during save, please try again' });
                    }
                    return res.status(500).json({ error: 'Failed to save chat' });
                }

                console.log(`Chat saved successfully with URL: ${animalUrl} (Edit: ${isEditLink ? 'Yes' : 'No'}, Ongoing: ${isOngoing ? 'Yes' : 'No'})`);
                const urlPath = isEditLink ? `/edit/${animalUrl}` : `/chat/${animalUrl}`;
                res.json({
                    success: true,
                    url: urlPath,
                    id: animalUrl
                });
            }
        );
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Failed to share chat' });
    }
});

// Update ongoing chat
app.put('/api/update/:animalUrl', async (req, res) => {
    try {
        const { animalUrl } = req.params;
        const { expiry, views, password } = req.body;

        // Verify this is an ongoing edit link
        const chat = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM chats WHERE animal_url = ? AND is_edit_link = 1 AND is_ongoing = 1 AND is_active = 1',
                [animalUrl],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!chat) {
            return res.status(404).json({ error: 'Ongoing chat not found' });
        }

        // Verify password
        const passwordValid = await verifyPassword(password, chat.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const expiresAt = calculateExpiryDate(expiry);
        const maxViews = parseMaxViews(views);

        db.run(
            `UPDATE chats SET expires_at = ?, max_views = ?, current_views = 0, last_updated = CURRENT_TIMESTAMP 
             WHERE animal_url = ?`,
            [expiresAt, maxViews, animalUrl],
            async function(err) {
                if (err) {
                    console.error('Update chat error:', err);
                    return res.status(500).json({ error: 'Failed to update chat' });
                }

                // Send push notification about update
                await sendPushNotification(animalUrl, 'Chat updated', 'update');

                res.json({ success: true });
            }
        );
    } catch (error) {
        console.error('Update chat error:', error);
        res.status(500).json({ error: 'Failed to update chat' });
    }
});

// Get shared chat
app.get('/api/chat/:animalUrl', async (req, res) => {
    try {
        const { animalUrl } = req.params;
        const { password } = req.query;

        db.get(
            `SELECT * FROM chats WHERE animal_url = ? AND is_active = 1`,
            [animalUrl],
            async (err, chat) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!chat) {
                    return res.status(404).json({ error: 'Chat not found' });
                }

                // Check if expired
                if (isExpired(chat)) {
                    db.run(`UPDATE chats SET is_active = 0 WHERE id = ?`, [chat.id]);
                    return res.status(410).json({ error: 'Chat has expired' });
                }

                // Check view limit (not for edit links)
                if (!chat.is_edit_link && isViewLimitExceeded(chat)) {
                    db.run(`UPDATE chats SET is_active = 0 WHERE id = ?`, [chat.id]);
                    return res.status(410).json({ error: 'View limit exceeded' });
                }

                // Check password
                const passwordValid = await verifyPassword(password, chat.password_hash);
                if (!passwordValid) {
                    return res.status(401).json({ error: 'Invalid password', requiresPassword: !!chat.password_hash });
                }

                // Increment view count (not for edit links)
                if (!chat.is_edit_link) {
                db.run(`UPDATE chats SET current_views = current_views + 1 WHERE id = ?`, [chat.id]);
                }

                let chatData = JSON.parse(chat.data);
                chatData = ensureMessageIds(chatData);

                res.json({
                    success: true,
                    data: chatData,
                    views: chat.current_views + (chat.is_edit_link ? 0 : 1),
                    maxViews: chat.max_views,
                    expiresAt: chat.expires_at,
                    isEditMode: chat.is_edit_link,
                    isOngoing: !!chat.is_ongoing
                });
            }
        );
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to retrieve chat' });
    }
});

// Get edit chat
app.get('/api/edit/:animalUrl', async (req, res) => {
    try {
        const { animalUrl } = req.params;
        const { password } = req.query;

        db.get(
            `SELECT * FROM chats WHERE animal_url = ? AND is_active = 1 AND is_edit_link = 1`,
            [animalUrl],
            async (err, chat) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!chat) {
                    return res.status(404).json({ error: 'Edit link not found' });
                }

                // Check if expired
                if (isExpired(chat)) {
                    db.run(`UPDATE chats SET is_active = 0 WHERE id = ?`, [chat.id]);
                    return res.status(410).json({ error: 'Edit link has expired' });
                }

                // Check password (always required for edit links)
                const passwordValid = await verifyPassword(password, chat.password_hash);
                if (!passwordValid) {
                    return res.status(401).json({ error: 'Invalid password', requiresPassword: true });
                }

                let chatData = JSON.parse(chat.data);
                chatData = ensureMessageIds(chatData);
                
                console.log(`Edit chat accessed: ${animalUrl} (Ongoing: ${chat.is_ongoing ? 'Yes' : 'No'})`);
                
                res.json({
                    success: true,
                    data: chatData,
                    isEditMode: true,
                    isOngoing: !!chat.is_ongoing,
                    animalUrl: animalUrl,
                    maxViews: chat.max_views,
                    expiresAt: chat.expires_at
                });
            }
        );
    } catch (error) {
        console.error('Get edit chat error:', error);
        res.status(500).json({ error: 'Failed to retrieve edit chat' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Serve static files (frontend)
app.use(express.static('public'));

// Edit view route
app.get('/edit/:animalUrl', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat view route
app.get('/chat/:animalUrl', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 10MB)' });
        }
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database closed.');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Spill The Tea server running on port ${PORT}`);
    console.log(`📝 Main app: http://localhost:${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    if (process.env.VAPID_PUBLIC_KEY) {
        console.log(`🔔 Push notifications enabled`);
    } else {
        console.log(`⚠️  Push notifications disabled (no VAPID keys)`);
    }
});

module.exports = app;