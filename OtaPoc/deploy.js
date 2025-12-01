const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Configuration
const VERSION = process.argv[2]; // Get version from command line arg
if (!VERSION) {
    console.error("❌ Please provide a version number. Usage: node deploy.js 2.0.1");
    process.exit(1);
}

const PROJECT_ROOT = __dirname;
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const BUNDLE_FILE = path.join(DIST_DIR, 'index.android.bundle');
const ZIP_FILE = path.join(DIST_DIR, 'update.zip');

// CDN Paths (Adjust these to match your local structure)
const CDN_ROOT = path.join(PROJECT_ROOT, '../local-system/cdn-server/storage/android');
const CDN_ZIP_DEST = path.join(CDN_ROOT, 'update.zip');
const METADATA_FILE = path.join(CDN_ROOT, 'metadata.json');

// 1. Ensure Dist Directory Exists
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);

console.log(`🚀 Starting Deployment for Version ${VERSION}...`);

try {
    // 2. Generate Bundle
    console.log("📦 Bundling React Native...");
    execSync(`npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output dist/index.android.bundle`, { stdio: 'inherit' });

    // 3. Zip Bundle (Using PowerShell for Windows compatibility without extra deps)
    console.log("🤐 Zipping bundle...");
    // Remove old zip if exists
    if (fs.existsSync(ZIP_FILE)) fs.unlinkSync(ZIP_FILE);
    
    // We cd into dist so the zip doesn't contain the 'dist' folder structure
    execSync(`powershell "Compress-Archive -Path '${BUNDLE_FILE}' -DestinationPath '${ZIP_FILE}' -Force"`, { stdio: 'inherit' });

    // 4. Calculate Hash
    console.log("#️⃣  Calculating Hash...");
    const fileBuffer = fs.readFileSync(ZIP_FILE);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const hexHash = hashSum.digest('hex');
    console.log(`   Hash: ${hexHash}`);

    // 5. Move to CDN
    console.log("🚚 Moving to CDN...");
    fs.copyFileSync(ZIP_FILE, CDN_ZIP_DEST);

    // 6. Update Metadata
    console.log("📝 Updating Metadata...");
    const metadata = {
        id: `v${VERSION.replace(/\./g, '')}`, // e.g., v201
        version: VERSION,
        fileUrl: "http://10.0.2.2:4000/files/android/update.zip",
        fileHash: hexHash,
        status: "UPDATE",
        force: false
    };

    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 4));

    console.log("✅ Deployment Complete!");
    console.log(`   Version: ${VERSION}`);
    console.log(`   URL: ${metadata.fileUrl}`);
    console.log(`   Metadata updated at: ${METADATA_FILE}`);

} catch (error) {
    console.error("❌ Deployment Failed:", error);
    process.exit(1);
}
