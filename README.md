# EstateFlow app (Android)

This is the phone app for field staff and customers. Staff get My day, leads, site visits with GPS check-in, follow-ups and tasks. Customers get their property, payments, receipts, documents and requests. All data comes from the **EstateFlow backend**, which must be running and reachable from the phone.

```
estateflow-app (phone, or http://localhost:7342 in a browser)  ──/api──▶  estateflow-backend
```

The `shared/` folder is the common code. The backend and the dashboard carry an identical copy.

The public Starwiz website is built in too (its code is in `site/`, shared with the dashboard). Signed out, the app opens on the sign-in screen; its **Browse our homes** link opens the website's property pages, which have **Sign in** in their menu. Signed in, property links such as `/homes/<slug>` still open, with **Back to the app**. For **Share** on published properties, set `websiteUrl` in `public/env.js` to the dashboard's address (links look like `<websiteUrl>/homes/<slug>`).

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

Open http://localhost:7342 and switch the browser to phone view (F12, then the phone icon). The sign-in screen opens first. With the demo backend, the sign-in screen has one-tap demo logins, including **Customer**. `/api` is forwarded to http://localhost:7341; to use another backend, run `$env:EF_API_PROXY="http://…:7341"` in PowerShell first.

## Run it on the Android emulator

Step-by-step Windows instructions are in [EMULATOR.md](EMULATOR.md). In short, with Android Studio installed and `estateflow-backend` unzipped next to this folder:

```powershell
npm install
npm run emulator:doctor   # checks Node, JDK 21, Android SDK, adb, emulator, AVD and the backend
npm run emulator:avd      # once: creates the EstateFlow_Pixel emulator
npm run android           # starts the demo API if needed, builds the debug APK, installs and opens it
```

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

### Release APK (real phones and the Play Store)

A release build talks only to your **online** backend over HTTPS (deploy `estateflow-backend` first, e.g. on Render; see its README). It never uses demo mode or 10.0.2.2.

1. Create the signing key once, in PowerShell in this folder (Android Studio's own `keytool` is used here; `keytool` from JDK 21 works too):
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore android\app\estateflow-release.jks -alias estateflow -keyalg RSA -keysize 2048 -validity 10000
   ```
   It asks for a password and your name/organisation. **Back up the `.jks` file and the password**: every future update must be signed with the same key, or phones and the Play Store refuse it.
2. Create `android\keystore.properties` (plain text, in the `android` folder):
   ```properties
   storeFile=estateflow-release.jks
   storePassword=YOUR_PASSWORD
   keyAlias=estateflow
   keyPassword=YOUR_PASSWORD
   ```
3. Build, with your backend's online address:
   ```powershell
   npm run build:release -- --api=https://estateflow-api.onrender.com
   ```
   The signed APK is at `android\app\build\outputs\apk\release\app-release.apk`. Copy it to a phone and open it to install (allow "Install unknown apps"), or `adb install -r` that path.
4. For the Play Store, build an app bundle instead: `npm run build:bundle -- --api=https://…`, which writes `android\app\build\outputs\bundle\release\app-release.aab`.
5. For each new release, raise `versionCode` (by 1) and `versionName` in `android\app\build.gradle`, and `APP_VERSION` in `shared\src\version.ts`.
6. Before using the emulator again, run `npm run build:android` (the release build cannot reach 10.0.2.2).

From Android Studio instead of step 3: run `npm run build:release -- --api=https://…` once to bundle the screens (or `$env:VITE_API_URL="https://…"; npm run android:sync`), then **Build → Generate Signed App Bundle or APK → APK → Next**, choose `android\app\estateflow-release.jks`, enter the passwords, pick **release**, **Create**. Android Studio shows a "locate" link to the APK when it finishes.

The package name is `com.thegradlew.estateflow`. Both the key and `keystore.properties` are git-ignored.

## Other commands

| Command | What it does |
|---|---|
| `npm run build:android` | Bundles the screens into `android/` (demo mode, API at http://10.0.2.2:7341), then open `android` in Android Studio and press ▶ Run |
| `npm run build:release -- --api=https://…` | Signed release APK for that online API (`build:bundle` for a Play Store `.aab`) |
| `npm run android` | Demo API + debug APK installed and opened on the emulator (same as `emulator:run`) |
| `npm run emulator:live` | Same, with live reload from the dev server |
| `npm run build` | Web build into `dist/` (what Capacitor packs into the APK) |
| `npm test` | Unit tests (14) |
| `npm run test:e2e` | Phone-size browser tests (11). They need `estateflow-backend` installed in the folder next to this one, or set `EF_BACKEND_DIR`, plus `npx playwright install chromium` once |
