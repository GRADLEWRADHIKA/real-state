# Run EstateFlow on the Android emulator (Windows)

You need two folders side by side, for example:

```
C:\dev\estateflow-backend   (from estateflow-backend.zip)
C:\dev\estateflow-app       (from estateflow-app.zip)
```

Keep them **outside OneDrive** (OneDrive locks files and `npm install` or Gradle then fail with `EPERM`). If Windows "Extract All" made a folder inside a folder (`estateflow-app\estateflow-app`), use the inner one; the script finds the backend either way.

## 1. Install the tools (once)

1. **Node.js 22 LTS or newer** from https://nodejs.org. Check with `node -v`.
2. **Android Studio** from https://developer.android.com/studio. Open it once and choose the **Standard** setup; it downloads the Android SDK, the emulator and a JDK.
3. In Android Studio: **More Actions → SDK Manager** (or Settings → Languages & Frameworks → Android SDK):
   - **SDK Platforms**: tick **Android 16 (API 36)**.
   - **SDK Tools**: tick **Android SDK Command-line Tools (latest)**, **Android Emulator** and **Android SDK Platform-Tools**. Click **Apply**.
4. Virtualization must be on, or the emulator will not start. Search Windows for "Turn Windows features on or off", tick **Windows Hypervisor Platform**, and restart. If it is still refused, enable "Intel VT-x" or "AMD-V / SVM" in the BIOS.

## 2. Set ANDROID_HOME and JAVA_HOME (once)

In PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
$p = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$p;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", "User")
```

**Close PowerShell and open a new window**, then check:

```powershell
& "$env:JAVA_HOME\bin\java" -version   # should say version "21..."
adb version
```

The scripts also find the SDK and Android Studio's JDK by themselves, so this step mainly helps Android Studio and manual commands.

## 3. Start the backend (window 1, leave it open)

```powershell
cd C:\dev\estateflow-backend
npm install
npm run dev
```

Check http://localhost:7341/api/health in a browser: it should show `{"ok":true,...}`. The emulator reaches this computer's localhost as **10.0.2.2**, so the app uses `http://10.0.2.2:7341`.

If you skip this step, `npm run android` starts the demo backend by itself from the folder next to the app.

## 4a. Run it from Android Studio (like any Android app)

1. In PowerShell (window 2), once and again after every code change:
   ```powershell
   cd C:\dev\estateflow-app
   npm install
   npm run build:android
   ```
   This bundles the app's screens into the Android project and points it at `http://10.0.2.2:7341`. The APK then runs on its own, with no browser or dev server.
2. Open Android Studio → **Open** → choose `C:\dev\estateflow-app\android` → **OK**. Click **Trust Project** if asked.
3. Wait for **Gradle sync** to finish (progress bar at the bottom; the first time takes several minutes). If it asks to upgrade the Android Gradle Plugin, choose **Don't ask again** / cancel.
4. Make an emulator: **Device Manager** (phone icon on the right edge) → **+** → **Create Virtual Device** → **Pixel 7** → **Next** → system image **API 35** (click the download arrow) → **Next** → **Finish**.
5. In the toolbar at the top, pick **app** in the first box and your **Pixel 7** in the device box, then press the green **▶ Run** button (Shift+F10).
6. The emulator starts and EstateFlow opens on the sign-in screen.

## 4b. Or do it all from the terminal (window 2)

```powershell
cd C:\dev\estateflow-app
npm install
npm run emulator:doctor    # every line should be ✓ (AVD is ✗ the first time)
npm run emulator:avd       # once: downloads an Android 15 image (about 1.5 GB) and creates "EstateFlow_Pixel"
npm run android            # boots the emulator, builds the APK, installs and opens EstateFlow
```

The first `npm run android` takes 5 to 15 minutes, because Gradle downloads its tools. Later runs take about a minute.

The app opens on the sign-in screen. Tap a role under the form, or type a login:

| Role | Email | Password |
|---|---|---|
| Sales Executive | sales@demo.com | Sales@123 |
| Sales Manager | manager@demo.com | Manager@123 |
| Customer | customer@demo.com | Customer@123 |

Instead of `emulator:avd` you can create the device in Android Studio (**Device Manager → + → Pixel 7 → API 35**) and start it there; `npm run android` uses any emulator that is already running.

**Live reload while editing code:** `npm run emulator:live` (changes in `src\` appear on the emulator).

## Troubleshooting

| Problem | Fix |
|---|---|
| `EPERM`, `operation not permitted`, `file is locked` | Move both folders out of OneDrive (e.g. to `C:\dev`), delete `node_modules`, and run `npm install` again. |
| `npm run emulator:doctor` shows ✗ for adb, emulator or sdkmanager | Install that item in Android Studio → SDK Manager → SDK Tools, then open a new PowerShell. |
| ✗ JDK 21 (e.g. "Java 17"), or Gradle says it needs Java 21 | Install **Temurin JDK 21** (https://adoptium.net, choose 21 LTS, and tick "Set JAVA_HOME" in the installer), then open a new PowerShell. In Android Studio also set **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** to a 21 JDK ("jbr-21" or Temurin 21). |
| `Parsing capacitor.config.ts failed` | Use the npm scripts (`npm run build:android`), not `npx cap ...` directly. Updating Node.js to the latest 22 LTS also fixes it. |
| `SDK location not found` | Set `ANDROID_HOME` (step 2), or create `android\local.properties` with `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`. |
| Emulator closes at once, or "hypervisor" / "x86 emulation" errors | Turn on Windows Hypervisor Platform and BIOS virtualization (step 1.4). |
| Port 7341 in use | Another backend is already running, which is fine if http://localhost:7341/api/health answers. Otherwise close the program using it. |
| App says it cannot reach the server | Keep the backend window open. On the sign-in screen the server address must be `http://10.0.2.2:7341`. |
| `adb: device offline`, or the install hangs | Run `adb kill-server`, then `adb start-server`, and run `npm run android` again. |
