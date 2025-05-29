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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for nginx-proxy
app.set('trust proxy', true);

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
db.serialize(() => {
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
        theme TEXT DEFAULT 'gradient'
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

    // Index for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_animal_url ON chats (animal_url)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_expires_at ON chats (expires_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_is_edit_link ON chats (is_edit_link)`);
});

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

function calculateExpiryDate(expiry) {
    if (expiry === 'never') return null;
    
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

// Cleanup expired chats (run every hour)
setInterval(() => {
    db.run(`UPDATE chats SET is_active = 0 WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`);
    console.log('Cleaned up expired chats');
}, 60 * 60 * 1000);

// API Routes

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
        const { chats, highlights, expiry, views, password, theme, isEditLink, customUrl } = req.body;

        if (!chats || !Array.isArray(chats)) {
            return res.status(400).json({ error: 'Invalid chat data' });
        }

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
            highlights,
            created: new Date().toISOString(),
            theme: theme || 'gradient'
        };

        const expiresAt = calculateExpiryDate(expiry);
        const maxViews = parseMaxViews(views);
        const passwordHash = await hashPassword(password);

        db.run(
            `INSERT INTO chats (id, animal_url, data, password_hash, expires_at, max_views, is_edit_link, theme) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, animalUrl, JSON.stringify(chatData), passwordHash, expiresAt, maxViews, isEditLink ? 1 : 0, theme || 'gradient'],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(500).json({ error: 'URL collision during save, please try again' });
                    }
                    return res.status(500).json({ error: 'Failed to save chat' });
                }

                console.log(`Chat saved successfully with URL: ${animalUrl}`);
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

// Get shared chat (both /chat/:url and /edit/:url)
async function getChatHandler(req, res, isEditMode = false) {
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

                // Check view limit (only for regular chats, not edit links)
                if (!isEditMode && !chat.is_edit_link && isViewLimitExceeded(chat)) {
                    db.run(`UPDATE chats SET is_active = 0 WHERE id = ?`, [chat.id]);
                    return res.status(410).json({ error: 'View limit exceeded' });
                }

                // Check password
                const passwordValid = await verifyPassword(password, chat.password_hash);
                if (!passwordValid) {
                    return res.status(401).json({ error: 'Invalid password', requiresPassword: !!chat.password_hash });
                }

                // Increment view count (only for regular chats)
                if (!isEditMode && !chat.is_edit_link) {
                db.run(`UPDATE chats SET current_views = current_views + 1 WHERE id = ?`, [chat.id]);
                }

                const chatData = JSON.parse(chat.data);
                res.json({
                    success: true,
                    data: chatData,
                    views: chat.current_views + (isEditMode || chat.is_edit_link ? 0 : 1),
                    maxViews: chat.max_views,
                    expiresAt: chat.expires_at,
                    isEditMode: isEditMode || chat.is_edit_link
                });
            }
        );
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to retrieve chat' });
    }
}

app.get('/api/chat/:animalUrl', (req, res) => getChatHandler(req, res, false));
app.get('/api/edit/:animalUrl', (req, res) => getChatHandler(req, res, true));

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
});

module.exports = app;