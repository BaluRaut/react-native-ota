# Secure OTA Proof of Concept (POC) Guide

Follow these steps exactly to prove the architecture works.

## Phase 1: AWS Setup (The Infrastructure)

### 1. Create the S3 Bucket (Private)
1.  Go to **S3 Console** -> **Create bucket**.
2.  Name: `ota-poc-secure-bucket` (or unique name).
3.  **Block Public Access settings:** Check "Block all public access".
4.  Create Bucket.

### 2. Create CloudFront Key Pair (For Signing)
*Note: You must be the Root user or have specific permissions.*
1.  Go to **CloudFront Console** -> **Key management** -> **Public keys**.
2.  You need a public/private key pair. Run this in your terminal to generate them:
    ```bash
    openssl genrsa -out private_key.pem 2048
    openssl rsa -pubout -in private_key.pem -out public_key.pem
    ```
3.  Upload `public_key.pem` to CloudFront.
4.  Create a **Key Group** and add this public key to it.
5.  **Save `private_key.pem` securely.** We need it for the Node.js server.
6.  Copy the **Key Group ID** (e.g., `K2JCJM...`).

### 3. Create CloudFront Distribution
1.  Go to **CloudFront Console** -> **Create distribution**.
2.  **Origin domain:** Select your S3 bucket.
3.  **Origin access:** Choose "Origin access control settings (recommended)" -> Create control setting -> Sign requests.
    *   *Important:* After creating, AWS will give you a Bucket Policy. Copy it and update your S3 Bucket Policy so CloudFront can read the files.
4.  **Viewer Protocol Policy:** Redirect HTTP to HTTPS.
5.  **Restrict Viewer Access:** **Yes**.
    *   **Trusted authorization type:** Trusted key groups.
    *   Add the Key Group you created in Step 2.
6.  Create Distribution.
7.  Copy the **Distribution Domain Name** (e.g., `d123.cloudfront.net`).

---

## Phase 2: The "Backend" (Local Signing Server)

Create a folder `backend` and add `server.js`.

1.  `mkdir backend`
2.  `cd backend`
3.  `npm init -y`
4.  `npm install express @aws-sdk/cloudfront-signer @aws-sdk/client-s3 dotenv cors`

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const s3 = new S3Client({ region: process.env.AWS_REGION });

// CONFIG
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL; // e.g., https://d123.cloudfront.net
const KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID; // From CloudFront Console (Public Key ID)
const PRIVATE_KEY = fs.readFileSync('private_key.pem', 'utf-8'); // The file you generated

app.post('/check', async (req, res) => {
    console.log("Received update check...");
    
    // 1. (Mock) Auth Check
    const authHeader = req.headers.authorization;
    if (authHeader !== 'Bearer secret-token') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // 2. Get Metadata from S3 (Private)
        // We assume the app sends { platform: 'ios' } in body
        const platform = req.body.platform || 'ios';
        
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${platform}/metadata.json`
        });
        
        const response = await s3.send(command);
        const str = await response.Body.transformToString();
        const metadata = JSON.parse(str);

        // 3. Sign the Bundle URL
        // Metadata has "url": "https://d123.../ios/bundle.js"
        // We need to sign that specific path.
        
        const signedUrl = getSignedUrl({
            url: metadata.url,
            keyPairId: KEY_PAIR_ID,
            privateKey: PRIVATE_KEY,
            dateLessThan: new Date(Date.now() + 1000 * 60 * 5), // 5 mins
        });

        console.log("Generated Signed URL:", signedUrl);

        // 4. Return modified metadata
        metadata.url = signedUrl;
        res.json(metadata);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => console.log('Auth Server running on port 3000'));
```

---

## Phase 3: The Client (React Native)

1.  Initialize project: `npx react-native init OtaPoc`
2.  Install deps: `npm install hot-updater-react-native react-native-device-info react-native-fs`
3.  **Configure `hot-updater.config.ts`** in root:

```typescript
import { defineConfig } from "hot-updater";
import { s3Storage, s3Database } from "@hot-updater/aws";
import { bare } from "@hot-updater/bare";
import dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  build: bare({ enableHermes: true }),
  storage: s3Storage({
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.AWS_REGION!,
    // AWS Credentials from env
  }),
  database: s3Database({
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.AWS_REGION!,
  }),
});
```

4.  **Modify `App.tsx`**:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { HotUpdater } from 'hot-updater-react-native';

const App = () => {
  const [status, setStatus] = useState('Waiting...');

  const checkUpdate = async () => {
    setStatus('Checking...');
    try {
      // Point to LOCALHOST (Use your PC IP if on real device, e.g., http://192.168.1.5:3000/check)
      // Android Emulator uses 10.0.2.2
      await HotUpdater.init({
        source: "http://10.0.2.2:3000/check", 
        requestHeaders: {
          Authorization: "Bearer secret-token"
        }
      });

      const update = await HotUpdater.check();
      if (update) {
        setStatus('Update found! Downloading...');
        await HotUpdater.download(update);
        Alert.alert("Update Ready", "Restarting...", [
            { text: "OK", onPress: () => HotUpdater.reload() }
        ]);
      } else {
        setStatus('No update available.');
      }
    } catch (e) {
      setStatus('Error: ' + e.message);
      console.error(e);
    }
  };

  return (
    <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
      <Text style={{fontSize: 20, marginBottom: 20}}>Version 1.0.0</Text>
      <Text style={{marginBottom: 20}}>{status}</Text>
      <Button title="Check Secure Update" onPress={checkUpdate} />
    </View>
  );
};

export default App;
```

---

## Phase 4: Execution

1.  **Start Backend:** `node server.js`
2.  **Run App (v1):** `npx react-native run-android`
    *   Click "Check Secure Update". It should say "No update available" (or error if bucket empty).
3.  **Make a Change:** Change "Version 1.0.0" to "Version 2.0.0" in `App.tsx`.
4.  **Deploy Update:**
    ```bash
    npx hot-updater deploy --platform android
    ```
    *   This uploads the bundle to S3.
5.  **Test Update:**
    *   Click "Check Secure Update" in the app again.
    *   **Success:** It talks to your server -> gets signed URL -> downloads from CloudFront -> Restarts -> Shows "Version 2.0.0".
    *   **Verify Security:** Try to open the `metadata.url` (from server logs) in an Incognito browser window *after* 5 minutes. It should fail (Access Denied).
