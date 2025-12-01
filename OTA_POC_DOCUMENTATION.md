# Self-Hosted OTA Update System - Proof of Concept (POC)

## 1. Overview
This project demonstrates a secure, self-hosted Over-The-Air (OTA) update system for React Native applications using the `hot-updater` library. The goal was to bypass third-party services (like CodePush) and maintain full control over the update distribution pipeline using a custom backend.

## 2. Architecture
The system consists of three main components running locally to simulate a production environment:

### A. The Client (React Native App)
*   **Framework:** React Native 0.82.0
*   **Library:** `@hot-updater/react-native` (v0.23.1)
*   **Role:** Checks for updates, downloads bundles, and reloads the JS context.

### B. The API Server (Port 3000)
*   **Role:** Acts as the "Gatekeeper".
*   **Function:**
    1.  Receives update checks from the app.
    2.  Validates the user (Mock Auth: `Bearer my-secret-user`).
    3.  Generates a **Signed URL** by appending a security token to the file URL.
    4.  Returns the update metadata to the app.

### C. The CDN Server (Port 4000)
*   **Role:** Acts as the "Storage".
*   **Function:**
    1.  Hosts the `update.zip` bundle.
    2.  **Security Guard:** Middleware checks for the `?token=secure-signature` query parameter.
    3.  Blocks access if the token is missing or invalid.

---

## 3. Implementation Steps

### Step 1: Server Setup
We created two simple Node.js Express servers:
*   **API Server:** `local-system/api-server/api.js`
*   **CDN Server:** `local-system/cdn-server/cdn.js`

### Step 2: App Configuration
1.  Installed `hot-updater` and `@hot-updater/react-native`.
2.  Configured `babel.config.js` to inject the Bundle ID.
3.  Updated `App.tsx` to handle the update logic.

### Step 3: Bundle Generation
We manually generated the update bundle to simulate a new version:
```bash
# 1. Generate JS Bundle
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output dist/index.android.bundle

# 2. Zip the bundle
Compress-Archive -Path dist/index.android.bundle -DestinationPath dist/update.zip

# 3. Move to CDN
mv dist/update.zip local-system/cdn-server/storage/android/
```

---

## 4. The Update Process Workflow

### A. Developer Side (Releasing an Update)

You can deploy updates either **Manually** (step-by-step) or **Automatically** (using our script).

#### Option 1: Automatic Deployment (Recommended)
We have created a script `deploy.js` in the project root that handles bundling, zipping, hashing, and updating metadata in one go.

1.  **Run the script:**
    ```bash
    # Usage: node deploy.js <NewVersion>
    node deploy.js 2.0.1
    ```
2.  **Done!** The script will:
    *   Build the React Native bundle.
    *   Zip it.
    *   Calculate the SHA256 hash.
    *   Copy it to the CDN folder.
    *   Update `metadata.json` automatically.

#### Option 2: Manual Deployment
If you prefer to do it step-by-step:

1.  **Modify Code:** Make changes to your React Native JavaScript/TypeScript code.
2.  **Generate Bundle:** Run the React Native bundler to compile the JS.
    ```bash
    npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output dist/index.android.bundle
    ```
3.  **Package Update:** Zip the bundle file.
    ```bash
    # PowerShell
    Compress-Archive -Path dist/index.android.bundle -DestinationPath dist/update.zip -Force
    ```
4.  **Calculate Hash:** You need the SHA256 hash for security.
    ```bash
    # Git Bash / Linux
    sha256sum dist/update.zip
    # PowerShell
    Get-FileHash dist/update.zip -Algorithm SHA256
    ```
5.  **Deploy Files:**
    *   Move `dist/update.zip` to `local-system/cdn-server/storage/android/`.
6.  **Update Metadata:**
    *   Open `local-system/cdn-server/storage/android/metadata.json`.
    *   Update `"version"`, `"fileHash"`, and `"id"`.

### B. User Side (Receiving an Update)
1.  **Check:** The App sends a request to `GET /check` with its current platform.
2.  **Authenticate:** The API Server validates the user's session/token.
3.  **Sign:** The API Server generates a temporary "Signed URL" (e.g., `.../update.zip?token=xyz`).
4.  **Download:** The App uses this secure URL to download the zip from the CDN.
5.  **Apply:** The `hot-updater` library unzips the bundle and replaces the current JS bundle.
6.  **Reload:** The App reloads the JS context, instantly showing the new version.

---

## 5. Challenges & Solutions (Troubleshooting Log)

During the implementation, we encountered several critical issues. Here is how we solved them:

### Issue 1: "Property '__HOT_UPDATER_BUNDLE_ID' doesn't exist"
*   **Problem:** The app crashed immediately on launch.
*   **Cause:** The `hot-updater` library relies on a Babel plugin to inject a unique ID into the bundle, but it wasn't configured.
*   **Solution:**
    1.  Installed `hot-updater` as a dev dependency.
    2.  Added `'hot-updater/babel-plugin'` to `babel.config.js`.
    3.  Cleared Metro cache (`npx react-native start --reset-cache`).

### Issue 2: "undefined is not a function" (API Mismatch)
*   **Problem:** Calling `HotUpdater.check()` caused a crash.
*   **Cause:** The documentation we initially followed was for an older version. We inspected the `node_modules` source code and found the API had changed in v0.23.
*   **Solution:**
    *   Changed `HotUpdater.check()` → `HotUpdater.checkForUpdate()`.
    *   Changed `update.download()` → `update.updateBundle()`.

### Issue 3: Server 404 / 403 Errors
*   **Problem:** The app could not communicate with the local API server.
*   **Cause:**
    1.  **Method Mismatch:** The App was sending a `GET` request, but the Server expected `POST`.
    2.  **Response Format:** The Server returned `url`, but the library expected `fileUrl`.
*   **Solution:**
    *   Updated `api.js` to handle `GET /check`.
    *   Updated `api.js` to return the exact JSON structure required by the library (`id`, `version`, `fileUrl`, `fileHash`, `status`).

### Issue 4: Network Security Policy
*   **Problem:** The Android app silently failed to reach `http://10.0.2.2:3000`.
*   **Cause:** Android blocks cleartext (HTTP) traffic by default in Release builds.
*   **Solution:**
    *   Modified `AndroidManifest.xml` to add `android:usesCleartextTraffic="true"`.

### Issue 5: "No update available" (Testing Logic)
*   **Problem:** We updated the code to "Version 2.0.0" and *then* built the app, so the app was already up to date.
*   **Cause:** To test an update, the installed app must be *older* than the server version.
*   **Solution:**
    1.  Reverted `App.tsx` to "Version 1.0.0".
    2.  Built and installed the APK.
    3.  Kept the Server serving "Version 2.0.0".
    4.  The update was successfully detected and applied.

---

## 6. Final Result
*   **Initial State:** App running **Version 1.0.0**.
*   **Action:** User clicked "Check for Secure Update".
*   **Process:** App authenticated -> Received Signed URL -> Downloaded Zip -> Reloaded.
*   **Final State:** App running **Version 2.0.0** without an App Store release.
