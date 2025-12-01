const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Point to the CDN storage to read metadata
// We go up one level from 'api-server' to 'local-system', then into 'cdn-server/storage'
const STORAGE_PATH = path.join(__dirname, '../cdn-server/storage');

app.get('/check', (req, res) => {
    console.log("🔎 App requested update check...");

    // 1. Auth Check (Mock)
    if (req.headers.authorization !== 'Bearer my-secret-user') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Client sends platform in headers: x-app-platform
    const platform = req.headers['x-app-platform'] || 'android';
    const metadataPath = path.join(STORAGE_PATH, platform, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
        console.log(`⚠️ Metadata not found at ${metadataPath}`);
        return res.json({ update: false }); // No metadata found
    }

    // 2. Read Metadata
    try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // 3. "Sign" the URL
        // We append the token that the CDN expects
        // Original URL in metadata: http://localhost:4000/files/android/bundle.js
        const signedUrl = `${metadata.fileUrl}?token=secure-signature`;

        console.log("✍️  Signed URL generated");

        // 4. Return to App
        res.json({
            ...metadata,
            fileUrl: signedUrl
        });
    } catch (err) {
        console.error("Error reading metadata:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(3000, () => console.log('🛡️  Auth API running on http://localhost:3000'));
