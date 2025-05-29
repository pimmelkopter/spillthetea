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
const db = new sqlite3.Database('./chatshare.db');

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
        is_active BOOLEAN DEFAULT 1
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
});

// Utility functions
function generateAnimalUrl() {
    const animals = [];
    for (let i = 0; i < 3; i++) {
        animals.push(ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)]);
    }
    return animals.join('-');
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
        const { chats, persons, highlights, expiry, views, password } = req.body;

        if (!chats || !Array.isArray(chats)) {
            return res.status(400).json({ error: 'Invalid chat data' });
        }

        const id = uuidv4();
        let animalUrl;
        const maxAttempts = 50;

        // Generate unique animal URL with proper async handling
        const findUniqueUrl = async () => {
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                animalUrl = generateAnimalUrl();
                
                try {
                    const existingChat = await new Promise((resolve, reject) => {
                        db.get('SELECT id FROM chats WHERE animal_url = ?', [animalUrl], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    // If no existing chat found, we have a unique URL
                    if (!existingChat) {
                        console.log(`Generated unique URL: ${animalUrl} (attempt ${attempts + 1})`);
                        return animalUrl;
                    }
                    
                    console.log(`URL collision: ${animalUrl} (attempt ${attempts + 1})`);
                } catch (dbError) {
                    console.error('Database error checking URL:', dbError);
                    // Continue trying with next URL on database error
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
            persons,
            highlights,
            created: new Date().toISOString()
        };

        const expiresAt = calculateExpiryDate(expiry);
        const maxViews = parseMaxViews(views);
        const passwordHash = await hashPassword(password);

        db.run(
            `INSERT INTO chats (id, animal_url, data, password_hash, expires_at, max_views) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, animalUrl, JSON.stringify(chatData), passwordHash, expiresAt, maxViews],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(500).json({ error: 'URL collision during save, please try again' });
                    }
                    return res.status(500).json({ error: 'Failed to save chat' });
                }

                console.log(`Chat saved successfully with URL: ${animalUrl}`);
                res.json({
                    success: true,
                    url: `/chat/${animalUrl}`,
                    id: animalUrl
                });
            }
        );
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Failed to share chat' });
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

                // Check view limit
                if (isViewLimitExceeded(chat)) {
                    db.run(`UPDATE chats SET is_active = 0 WHERE id = ?`, [chat.id]);
                    return res.status(410).json({ error: 'View limit exceeded' });
                }

                // Check password
                const passwordValid = await verifyPassword(password, chat.password_hash);
                if (!passwordValid) {
                    return res.status(401).json({ error: 'Invalid password', requiresPassword: !!chat.password_hash });
                }

                // Increment view count
                db.run(`UPDATE chats SET current_views = current_views + 1 WHERE id = ?`, [chat.id]);

                const chatData = JSON.parse(chat.data);
                res.json({
                    success: true,
                    data: chatData,
                    views: chat.current_views + 1,
                    maxViews: chat.max_views,
                    expiresAt: chat.expires_at
                });
            }
        );
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to retrieve chat' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Serve static files (frontend)
app.use(express.static('public'));

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
    console.log(`🚀 Chat Share server running on port ${PORT}`);
    console.log(`📝 Main app: http://localhost:${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

module.exports = app;