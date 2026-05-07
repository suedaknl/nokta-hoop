# Developer Setup

This guide explains how a new developer can run `nokta-hoop` on an Android
phone without USB by using a dev-client APK, a local token server, Cloudflare
Tunnel for the token server, and Expo Metro for the mobile app.

## 1. Install Prerequisites

Install these tools:

- Node.js LTS
- npm
- Android Studio and Android SDK
- Java JDK 17
- Git
- Cloudflare Tunnel client (`cloudflared`)

Install `cloudflared` on Windows:

```powershell
winget install --id Cloudflare.cloudflared --source winget
```

Verify:

```powershell
cloudflared --version
```

If VS Code terminal cannot find `cloudflared`, fully close and reopen VS Code.

## 2. Get Stream Credentials

Create or open a Stream Video app:

1. Go to https://dashboard.getstream.io/
2. Create/select an app.
3. Open the app's Video settings.
4. Copy:
   - Stream API Key
   - Stream API Secret
5. Enable video transcription for the app/call type if it is not already
   enabled.

Never commit the Stream API Secret.

## 3. Optional: Get Groq Credentials

Groq is optional. Without it, the Mascot uses the local deterministic decision
engine. With it, the Mascot can generate real AI answers and decide whether a
mentor is needed.

1. Go to https://console.groq.com/
2. Create an API key.
3. Keep the key only in `services/token-server/.env`.

Never commit the Groq API key.

## 4. Install Project Dependencies

From the repository root:

```powershell
npm install
```

## 5. Create Environment Files

From the repository root:

```powershell
copy services\token-server\.env.example services\token-server\.env
copy apps\mobile\.env.example apps\mobile\.env
```

Edit `services/token-server/.env`:

```env
PORT=8787
HOST=0.0.0.0
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
ALLOWED_ORIGINS=*
STREAM_TRANSCRIPTION_LANGUAGE=tr
GROQ_API_KEY=optional_groq_api_key_for_ai_mascot
GROQ_MODEL=llama-3.3-70b-versatile
```

Edit `apps/mobile/.env`:

```env
EXPO_PUBLIC_STREAM_API_KEY=your_stream_api_key
EXPO_PUBLIC_TOKEN_SERVER_URL=https://replace-after-cloudflare-starts.trycloudflare.com
EXPO_PUBLIC_STREAM_ENABLE_TRANSCRIPTION=true
EXPO_PUBLIC_STREAM_TRANSCRIPTION_LANGUAGE=tr
```

`EXPO_PUBLIC_TOKEN_SERVER_URL` will be updated after Cloudflare Tunnel starts.

## 6. Start The Token Server

Terminal 1:

```powershell
npm run server:dev
```

Expected output:

```text
nokta-hoop token server running at http://0.0.0.0:8787
```

Verify locally in another terminal:

```powershell
curl http://127.0.0.1:8787/health
```

Expected response:

```json
{"status":"ok","service":"nokta-hoop-token-server"}
```

## 7. Expose Token Server With Cloudflare Tunnel

Terminal 2:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Use `127.0.0.1`, not `localhost`. On Windows, `localhost` may resolve to IPv6
`::1`, which can cause Cloudflare 502 errors.

Copy the generated URL:

```text
https://example-random-name.trycloudflare.com
```

Verify:

```powershell
curl https://example-random-name.trycloudflare.com/health
```

Then update `apps/mobile/.env`:

```env
EXPO_PUBLIC_TOKEN_SERVER_URL=https://example-random-name.trycloudflare.com
```

## 8. Install Or Build The Android Dev Client

The app cannot run in Expo Go because it uses native Stream WebRTC modules.
Each phone needs the Nokta Hoop dev-client APK installed.

If a teammate already shared the dev-client APK, install that APK on the phone.

If you need to build it yourself:

```powershell
npm run mobile:android
```

The generated debug APK is usually located at:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Native dependency changes require a new dev-client APK. JavaScript-only changes
do not.

## 9. Start Expo Metro

Terminal 3:

```powershell
npm run mobile:start -- --clear
```

Open the project from the installed Nokta Hoop dev-client app using the QR code
or URL shown by Expo.

If the phone cannot reach Metro over LAN, check:

- phone and computer are on the same Wi-Fi
- Windows Firewall allows Node.js on Private networks
- port `8081` is reachable from the phone

Quick firewall rule for Metro:

```powershell
New-NetFirewallRule -DisplayName "Nokta Hoop Metro 8081" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -Profile Private
```

## 10. Run The App

1. Open the dev-client app on the phone.
2. Open the Metro project from the QR/link.
3. Enter a display name and user ID.
4. Share the same room ID with another tester.
5. Join the call.
6. End the call.
7. Wait for the transcript screen.
8. Press refresh if Stream transcription is still processing.

## 11. Useful Commands

Run token server:

```powershell
npm run server:dev
```

Run Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Run Metro:

```powershell
npm run mobile:start -- --clear
```

Build Android dev client:

```powershell
npm run mobile:android
```

Run checks:

```powershell
npm run typecheck
npm run test
```

## 12. Common Problems

### Token request timed out

The mobile app cannot reach the token server.

Check:

- `npm run server:dev` is running.
- Cloudflare Tunnel is running.
- `apps/mobile/.env` uses the current `trycloudflare.com` URL.
- Metro was restarted after editing `.env`.

### Cloudflare 502 Bad Gateway

Cloudflare cannot reach the local token server.

Use:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Do not use:

```powershell
cloudflared tunnel --url http://localhost:8787
```

### Expo Go does not work

This is expected. The app needs a custom dev-client APK because Stream Video
uses native WebRTC modules.

### Phone cannot connect to development server

Metro is not reachable from the phone.

Try these:

```powershell
npm run mobile:start -- --clear --lan
```
```powershell
npm run mobile:start -- --clear --tunnel
```

Then check Windows Firewall and Wi-Fi isolation settings.
