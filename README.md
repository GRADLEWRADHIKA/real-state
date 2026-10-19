# EstateFlow app (Android)

This is the phone app for field staff and customers. Staff get My day, leads, site visits with GPS check-in, follow-ups and tasks. Customers get their property, payments, receipts, documents and requests. All data comes from the **EstateFlow backend**, which must be running and reachable from the phone.

```
estateflow-app (phone, or http://localhost:7342 in a browser)  ──/api──▶  estateflow-backend
```

The `shared/` folder is the common code. The backend and the dashboard carry an identical copy.

The public Starwiz website is built in too (its code is in `site/`, shared with the dashboard). Signed out, the app opens on the website, with **Sign in** in its menu; the sign-in screen has **Browse our homes** to go back. Signed in, property links such as `/homes/<slug>` still open, with **Back to the app**. For **Share** on published properties, set `websiteUrl` in `public/env.js` to the dashboard's address (links look like `<websiteUrl>/homes/<slug>`).

## Before you start

- **Node.js 22.22 or newer.** Install the latest "LTS" version from nodejs.org. Check with `node -v`.
- Unzip outside OneDrive or Dropbox, to avoid `EPERM` errors during `npm install`.
- Start `estateflow-backend` first (`npm run dev` in that folder).

## Try it in a browser

```bash
cd estateflow-app
npm install
npm run dev
```

Open http://localhost:7342 and switch the browser to phone view (F12, then the phone icon). The website opens first; tap **Sign in** in its menu. With the demo backend, the sign-in screen has one-tap demo logins, including **Customer**. `/api` is forwarded to http://localhost:7341; to use another backend, run `$env:EF_API_PROXY="http://…:7341"` in PowerShell first.

## Build the Android APK

You need:
- **Android Studio**, which brings JDK 21 and the Android SDK. Install SDK Platform 36 from its SDK Manager.
- On Windows, `ANDROID_HOME` set to the SDK folder (usually `C:\Users\<you>\AppData\Local\Android\Sdk`), or a file `android\local.properties` containing `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`.

The app must know your backend's online address, which must be HTTPS. In PowerShell:

```powershell
$env:VITE_API_URL="https://estateflow-api.onrender.com"
npm run android:apk
```

The APK is at `android\app\build\outputs\apk\debug\app-debug.apk`. Copy it to a phone and install it, or use `adb install -r` with that path.

If you skip `VITE_API_URL`, the app asks for the server address on its sign-in screen, where it can always be changed.

To open the project in Android Studio, run `npm run android:sync` and then `npm run android:open`.

### Release build for the Play Store

1. Create the signing key once, and keep it and its passwords safe. Every update must be signed with the same key.
   `keytool -genkeypair -v -keystore android/app/estateflow-release.jks -alias estateflow -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/keystore.properties`:
   ```properties
   storeFile=estateflow-release.jks
   storePassword=…
   keyAlias=estateflow
   keyPassword=…
   ```
3. Run `npm run android:release` (signed APK) or `npm run android:bundle` (`.aab` for the Play Store).
4. For each new release, raise `versionCode` and `versionName` in `android/app/build.gradle` and `APP_VERSION` in `shared/src/version.ts`.

The package name is `com.thegradlew.estateflow`. Both the key and `keystore.properties` are git-ignored.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Web build into `dist/` (what Capacitor packs into the APK) |
| `npm test` | Unit tests (14) |
| `npm run test:e2e` | Phone-size browser tests (11). They need `estateflow-backend` installed in the folder next to this one, or set `EF_BACKEND_DIR`, plus `npx playwright install chromium` once |
