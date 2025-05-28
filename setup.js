const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Chat Share database...');

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
}

// Create public directory if it doesn't exist
const publicDir = 'public';
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('✅ Created public directory');
}

// Initialize database
const db = new sqlite3.Database('./chatshare.db');

db.serialize(() => {
    console.log('📊 Creating database tables...');

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
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating chats table:', err);
        } else {
            console.log('✅ Created chats table');
        }
    });

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
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating files table:', err);
        } else {
            console.log('✅ Created files table');
        }
    });

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_animal_url ON chats (animal_url)`, (err) => {
        if (err) {
            console.error('❌ Error creating animal_url index:', err);
        } else {
            console.log('✅ Created animal_url index');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_expires_at ON chats (expires_at)`, (err) => {
        if (err) {
            console.error('❌ Error creating expires_at index:', err);
        } else {
            console.log('✅ Created expires_at index');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON chats (created_at)`, (err) => {
        if (err) {
            console.error('❌ Error creating created_at index:', err);
        } else {
            console.log('✅ Created created_at index');
        }
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err);
        process.exit(1);
    } else {
        console.log('✅ Database setup completed successfully!');
        console.log('');
        console.log('🎉 Chat Share is ready to go!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Move the frontend files (index.html, chat.html) to the public/ directory');
        console.log('2. Install dependencies: npm install');
        console.log('3. Start the server: npm start');
        console.log('4. Visit http://localhost:3000');
        process.exit(0);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n❌ Setup interrupted');
    db.close();
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    db.close();
    process.exit(1);
});