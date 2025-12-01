# Local Secure OTA Proof of Concept
## "No Cloud" Edition

This guide simulates the entire secure architecture on your local machine.

### Prerequisites
*   Node.js installed
*   React Native environment set up

---

### 1. Setup the "Local Cloud" (Simulating S3 + CloudFront)

Create a folder `local-system` and inside it `cdn-server`.

```bash
mkdir -p local-system/cdn-server/storage/android
cd local-system/cdn-server
npm init -y
npm install express cors
```

Create `cdn.js` (This acts as CloudFront):
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());

// MIDDLEWARE: Simulate "Signed URL" Security
// Only allow downloads if ?token=secure-signature is present
const secureGuard = (req, res, next) => {
    const token = req.query.token;
    if (token !== 'secure-signature') {
        console.log(`🛑 Blocked access to ${req.path} (Missing/Invalid Token)`);
        return res.status(403).send('Forbidden: Invalid Signature');
    }
    console.log(`✅ Serving ${req.path}`);
    next();
};

// Serve static files from 'storage' folder, PROTECTED by guard
app.use('/files', secureGuard, express.static(path.join(__dirname, 'storage')));

app.listen(4000, () => {
    console.log('☁️  Fake CloudFront running on http://localhost:4000');
    console.log('📂 Serving files from ./storage');
});
```

---

### 2. Setup the "Backend API" (The Gatekeeper)

Go back to `local-system` and create `api-server`.

```bash
cd ..
mkdir api-server
cd api-server
npm init -y
npm install express cors
```

Create `api.js`:
```javascript
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Point to the CDN storage to read metadata
const STORAGE_PATH = path.join(__dirname, '../cdn-server/storage');

app.post('/check', (req, res) => {
    console.log("🔎 App requested update check...");

    // 1. Auth Check (Mock)
    if (req.headers.authorization !== 'Bearer my-secret-user') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const platform = req.body.platform || 'android';
    const metadataPath = path.join(STORAGE_PATH, platform, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
        return res.json({ update: false }); // No metadata found
    }

    // 2. Read Metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // 3. "Sign" the URL
    // We append the token that the CDN expects
    // Original URL in metadata: http://localhost:4000/files/android/bundle.js
    const signedUrl = `${metadata.url}?token=secure-signature`;

    console.log("✍️  Signed URL generated");

    // 4. Return to App
    res.json({
        ...metadata,
        url: signedUrl
    });
});

app.listen(3000, () => console.log('🛡️  Auth API running on http://localhost:3000'));
```

---

### 3. The "Deployment" (Manual)

Since we aren't using AWS plugins, we will manually "deploy" an update.

1.  **Create the Metadata File:**
    Create `local-system/cdn-server/storage/android/metadata.json`:
    ```json
    {
        "id": "v2",
        "version": "2.0.0",
        "url": "http://10.0.2.2:4000/files/android/index.android.bundle",
        "force": false
    }
    ```
    *(Note: `10.0.2.2` is localhost for Android Emulator. Use your LAN IP `192.168.x.x` for real devices)*

2.  **Bundle Your App:**
    In your React Native project root:
    ```bash
    npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output index.android.bundle
    ```

3.  **Upload:**
    Move the generated `index.android.bundle` into `local-system/cdn-server/storage/android/`.

---

### 4. The Client (React Native App)

In your `App.tsx`:

```tsx
import { HotUpdater } from 'hot-updater-react-native';

// ... inside component
const checkUpdate = async () => {
    try {
        // Point to API (Port 3000)
        await HotUpdater.init({
            source: "http://10.0.2.2:3000/check",
            requestHeaders: {
                Authorization: "Bearer my-secret-user"
            }
        });

        const update = await HotUpdater.check();
        if (update) {
            console.log("Update found, downloading from:", update.url);
            await HotUpdater.download(update);
            HotUpdater.reload();
        }
    } catch (e) {
        console.error(e);
    }
};
```

### 5. Run the Test

1.  Start CDN: `node local-system/cdn-server/cdn.js`
2.  Start API: `node local-system/api-server/api.js`
3.  Run App.
4.  **Verify Security:**
    *   Try opening `http://localhost:4000/files/android/index.android.bundle` in your browser.
    *   **Result:** 🛑 `Forbidden: Invalid Signature` (Good!)
    *   Try opening `http://localhost:4000/files/android/index.android.bundle?token=secure-signature`
    *   **Result:** ✅ File downloads (Good!)
