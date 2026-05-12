// Run: node compress-images.js
const admin = require('./functions/node_modules/firebase-admin');
const key   = require('./functions/serviceAccountKey.json');
const https = require('https');
const sharp = require('sharp'); // npm install sharp

admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

async function compressAndReupload() {
    const snap = await db.collection('products').get();
    console.log(`Processing ${snap.docs.length} products...`);
    
    for (const doc of snap.docs) {
        const p = doc.data();
        // Images are already in Firebase Storage — 
        // just update the admin panel to re-upload them through
        // the new WebP compression pipeline
        console.log(`${p.name}: ${p.image ? '✓' : '✗'}`);
    }
    console.log('Done. Re-upload images through admin panel for WebP conversion.');
    process.exit();
}

compressAndReupload();