# React Native Self-Hosted OTA Update System 🚀

This repository contains a complete Proof of Concept (POC) for a secure, self-hosted Over-The-Air (OTA) update system for React Native applications. It demonstrates how to bypass third-party services like CodePush and maintain full control over your update distribution pipeline using `hot-updater`.

## 📚 Documentation

We have detailed documentation covering every aspect of this project:

| Document | Description |
|----------|-------------|
| [**Main Documentation**](./OTA_POC_DOCUMENTATION.md) | **Start Here!** Complete guide on architecture, implementation, troubleshooting, and the update workflow. |
| [**Architecture Design**](./OTA_ARCHITECTURE.md) | High-level system design, security flow (Signed URLs), and component interaction diagrams. |
| [**Client Setup**](./CLIENT_SETUP.md) | Specifics on configuring the React Native app (Babel, AndroidManifest, etc.). |
| [**Local Environment**](./POC_LOCAL.md) | Details on the local Node.js servers (API & CDN) used for simulation. |
| [**POC Instructions**](./POC_INSTRUCTIONS.md) | Step-by-step instructions for running the Proof of Concept. |

## 📂 Project Structure

*   **`OtaPoc/`**: The React Native Client Application (v0.82.0).
*   **`local-system/`**: The backend infrastructure.
    *   `api-server/`: Express server acting as the Auth & Signing Gatekeeper (Port 3000).
    *   `cdn-server/`: Express server acting as the Secure Storage/CDN (Port 4000).

## ⚡ Quick Start

1.  **Start Local Servers:**
    ```bash
    # Terminal 1
    node local-system/api-server/api.js
    # Terminal 2
    node local-system/cdn-server/cdn.js
    ```

2.  **Run the App:**
    ```bash
    cd OtaPoc
    npx react-native run-android --mode=release
    ```

3.  **Deploy an Update:**
    ```bash
    cd OtaPoc
    node deploy.js 2.0.1
    ```

## 🛡️ Security Features

*   **Signed URLs:** The CDN blocks direct access. The App must authenticate with the API to get a temporary token.
*   **Hash Verification:** The App verifies the SHA256 hash of the downloaded bundle before applying it.
*   **Self-Hosted:** No code is shared with third-party providers.

---
*Created as part of a POC to validate secure, cost-effective OTA updates.*
