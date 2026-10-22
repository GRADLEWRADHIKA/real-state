#!/usr/bin/env node
// EstateFlow on the Android emulator, on Windows, macOS and Linux.
//   node scripts/emulator.mjs doctor   check Node, JDK 21, Android SDK, adb, emulator, an AVD and the backend
//   node scripts/emulator.mjs avd      create the "EstateFlow_Pixel" AVD (Pixel 7, Google APIs, API 35; --api=34 for 34)
//   node scripts/emulator.mjs bundle   build the screens into android/ (API http://10.0.2.2:7341), ready for Android Studio ▶ Run
//   node scripts/emulator.mjs run      demo API + debug APK installed and launched on the emulator
//   node scripts/emulator.mjs release  signed release APK against the online API (--api=https://… or VITE_API_URL); --aab for the Play Store
//   node scripts/emulator.mjs live     demo API + app dev server with live reload on the emulator
// Add --dry-run to print each step without running it.
// The demo API comes from the estateflow-backend folder next to this one (or EF_BACKEND_DIR). If an
// API already answers on port 7341 it is used as it is.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const win = process.platform === 'win32';
const exe = (name) => (win ? `${name}.exe` : name);
const bat = (name) => (win ? `${name}.bat` : name);
const [cmd = 'doctor', ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry-run');
const AVD = 'EstateFlow_Pixel';
const APP_ID = 'com.thegradlew.estateflow';
const PORTS = { api: 7341, app: 7342 };

const c = (n) => (s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const green = c(32),
  red = c(31),
  yellow = c(33),
  bold = c(1);

// ─── Locating the backend, the SDK and Java ──────────────────────────────
function backendDir() {
  const candidates = [
    process.env.EF_BACKEND_DIR,
    path.join(root, '..', 'estateflow-backend'),
    path.join(root, '..', '..', 'estateflow-backend'),
    // Windows "Extract All" makes estateflow-backend\estateflow-backend
    path.join(root, '..', '..', 'estateflow-backend', 'estateflow-backend'),
  ].filter(Boolean);
  return candidates.map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, 'package.json'))) ?? null;
}
const backend = backendDir();

function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    win && process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.platform === 'darwin' && path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    process.platform === 'linux' && path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}
const sdk = sdkRoot();
function tool(rel, name) {
  const fromSdk = sdk && path.join(sdk, rel, name);
  if (fromSdk && fs.existsSync(fromSdk)) return fromSdk;
  const which = spawnSync(win ? 'where' : 'which', [name], { encoding: 'utf8' });
  return which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() : null;
}
const cmdline = (name) => tool(path.join('cmdline-tools', 'latest', 'bin'), bat(name));
const tools = {
  adb: tool('platform-tools', exe('adb')),
  emulator: tool('emulator', exe('emulator')),
  sdkmanager: cmdline('sdkmanager'),
  avdmanager: cmdline('avdmanager'),
};

function javaMajor(home) {
  const java = home ? path.join(home, 'bin', exe('java')) : 'java';
  const r = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const m = `${r.stderr}${r.stdout}`.match(/version "(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return m[1] === '1' ? Number(m[2]) : Number(m[1]);
}
// Gradle 8.14 runs on Java 21 to 24; Capacitor 8 needs 21. Android Studio ships a suitable JDK ("jbr").
const javaOk = (v) => v >= 21 && v <= 24;
function findJava() {
  const studio = [
    win && path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Android', 'Android Studio', 'jbr'),
    win && process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'),
    process.platform === 'darwin' && '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    process.platform === 'linux' && '/opt/android-studio/jbr',
  ].filter(Boolean);
  // Prefer a suitable JDK (e.g. Android Studio's) over an older JAVA_HOME; otherwise report what was found.
  const found = [process.env.JAVA_HOME, ...studio]
    .filter((home) => home && fs.existsSync(home))
    .map((home) => ({ home, version: javaMajor(home) }))
    .filter((j) => j.version);
  const onPath = javaMajor(null);
  if (onPath) found.push({ home: null, version: onPath });
  return found.find((j) => javaOk(j.version)) ?? found[0] ?? null;
}
const java = findJava();
// Gradle gets JAVA_HOME and ANDROID_HOME even when they are not set in the shell.
const buildEnv = {
  ...process.env,
  ...(java?.home && javaOk(java.version) ? { JAVA_HOME: java.home } : {}),
  ...(sdk ? { ANDROID_HOME: sdk } : {}),
};

const portAnswers = (port) =>
  new Promise((resolve) => {
    const s = net
      .connect(port, '127.0.0.1')
      .once('connect', () => (s.end(), resolve(true)))
      .once('error', () => resolve(false));
  });
const apiHealthy = () =>
  fetch(`http://127.0.0.1:${PORTS.api}/api/health`)
    .then((r) => r.ok)
    .catch(() => false);
function listAvds() {
  if (!tools.emulator) return [];
  const r = spawnSync(tools.emulator, ['-list-avds'], { encoding: 'utf8' });
  return r.status === 0
    ? r.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('INFO'))
    : [];
}
function devices() {
  if (!tools.adb) return [];
  const r = spawnSync(tools.adb, ['devices'], { encoding: 'utf8' });
  return (r.stdout ?? '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(/\s+/))
    .filter(([id, state]) => id && state === 'device')
    .map(([id]) => id);
}

// ─── Running steps ───────────────────────────────────────────────────────
// .bat/.cmd files need a shell on Windows; quote anything with spaces or ; so cmd.exe keeps it whole.
const needsShell = (file) => win && /\.(bat|cmd)$/i.test(file);
const q = (s) => (/[\s;&()^]/.test(s) ? `"${s}"` : s);
function prep(file, args) {
  return needsShell(file) ? [q(file), args.map(q), true] : [file, args, false];
}
function step(title, file, args, opts = {}) {
  console.log(`\n${bold('›')} ${title}\n  ${[file, ...args].map(q).join(' ')}`);
  if (dry) return 0;
  const [f, a, shell] = prep(file, args);
  const r = spawnSync(f, a, { stdio: 'inherit', shell, ...opts });
  if (r.status !== 0) {
    console.error(red(`\n✗ ${title} failed (exit ${r.status ?? r.error?.message}). See "Troubleshooting" in EMULATOR.md.`));
    process.exit(r.status || 1);
  }
  return 0;
}
function background(title, file, args, opts = {}) {
  console.log(`\n${bold('›')} ${title} (background)\n  ${[file, ...args].map(q).join(' ')}`);
  if (dry) return null;
  const [f, a, shell] = prep(file, args);
  const child = spawn(f, a, { stdio: 'inherit', shell, ...opts });
  child.on('exit', (code) => code && console.error(red(`${title} stopped (exit ${code})`)));
  return child;
}
const npm = win ? 'npm.cmd' : 'npm';
// Capacitor loads capacitor.config.ts through Node's TypeScript support (TypeScript 7 has no compiler API for it);
// the flag turns that on for Node 22.6 to 22.17, where it is not on by default yet.
const cap = (...args) => [process.execPath, ['--experimental-strip-types', path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), ...args]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doctor({ quiet = false } = {}) {
  const missing = [];
  const row = (ok, label, detail, fix) => {
    if (!quiet || !ok) console.log(`${ok ? green('✓') : red('✗')} ${label.padEnd(18)} ${detail}`);
    if (!ok) missing.push(fix);
  };
  if (!quiet) console.log(bold('EstateFlow emulator check\n'));
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  row(nodeMajor >= 22, 'Node.js', `v${process.versions.node}`, 'Install Node.js 22 LTS or newer from nodejs.org.');
  row(fs.existsSync(path.join(root, 'node_modules', '@capacitor', 'cli')), 'app packages', fs.existsSync(path.join(root, 'node_modules')) ? 'installed' : 'not installed', 'Run `npm install` in this folder.');
  row(
    !!java && javaOk(java.version),
    'JDK 21',
    java ? `Java ${java.version}${java.home ? ` at ${java.home}` : ' on PATH'}` : 'java not found',
    'Install Android Studio (its bundled JDK is used automatically), or install JDK 21 and set JAVA_HOME to it.',
  );
  row(!!sdk, 'Android SDK', sdk ?? 'not found (ANDROID_HOME unset)', 'Install Android Studio, open it once to finish setup, and set ANDROID_HOME to the SDK folder.');
  row(!!tools.adb, 'adb', tools.adb ?? 'not found', 'Android Studio → SDK Manager → SDK Tools → Android SDK Platform-Tools.');
  row(!!tools.emulator, 'emulator', tools.emulator ?? 'not found', 'Android Studio → SDK Manager → SDK Tools → Android Emulator.');
  // sdkmanager is only needed by emulator:avd, so it is a warning here, not a blocker.
  if (tools.sdkmanager) row(true, 'sdkmanager', tools.sdkmanager);
  else console.log(`${yellow('!')} ${'sdkmanager'.padEnd(18)} not found; only \`npm run emulator:avd\` needs it (Android Studio → SDK Manager → SDK Tools → Android SDK Command-line Tools).`);
  const avds = listAvds();
  row(avds.length > 0, 'AVD', avds.length ? avds.join(', ') : 'none', 'Run `npm run emulator:avd` (or create a Pixel device, API 34/35, in Android Studio → Device Manager).');
  const running = await apiHealthy();
  const portBusy = !running && (await portAnswers(PORTS.api));
  row(
    running || (!!backend && !portBusy),
    'backend',
    running ? `EstateFlow API already running on :${PORTS.api}` : portBusy ? `port ${PORTS.api} is used by another program` : backend ? `will start from ${backend}` : 'estateflow-backend folder not found',
    portBusy
      ? `Close the program using port ${PORTS.api}.`
      : 'Unzip estateflow-backend next to this folder (or set EF_BACKEND_DIR), or start it yourself with `npm run dev` in that folder.',
  );
  if (process.platform === 'linux' && !fs.existsSync('/dev/kvm')) console.log(`${yellow('!')} ${'acceleration'.padEnd(18)} /dev/kvm missing: the emulator will be very slow.`);
  if (/onedrive/i.test(root)) console.log(`${yellow('!')} ${'folder'.padEnd(18)} inside OneDrive: if npm or Gradle fails with EPERM / file locked, move the folders to e.g. C:\\dev.`);
  if (missing.length) {
    console.log(`\n${red(`${missing.length} thing(s) to fix:`)}\n${missing.map((m) => `  • ${m}`).join('\n')}\n`);
  } else if (!quiet) console.log(green('\nReady. Run `npm run android`.'));
  return missing.length === 0;
}

async function ensureApi() {
  if (await apiHealthy()) {
    console.log(`\n${green('✓')} EstateFlow API already answering on :${PORTS.api}`);
    return null;
  }
  if (!backend) return null; // dry run without a backend folder; real runs stop earlier
  if (!fs.existsSync(path.join(backend, 'node_modules'))) step('Install the backend packages', npm, ['install'], { cwd: backend });
  const child = background(`Start the demo API from ${backend}`, npm, ['run', 'start:demo'], { cwd: backend });
  if (!dry) {
    for (let i = 0; i < 90 && !(await apiHealthy()); i++) await sleep(1000);
    if (!(await apiHealthy())) {
      console.error(red(`The demo API did not start on port ${PORTS.api}. Run \`npm run dev\` in ${backend} to see why.`));
      process.exit(1);
    }
  }
  return child;
}

async function ensureEmulator() {
  const running = devices().filter((d) => d.startsWith('emulator-'));
  if (running.length) {
    console.log(`\n${green('✓')} Emulator running: ${running[0]}`);
    return running[0];
  }
  const avds = listAvds();
  const avd = avds.includes(AVD) ? AVD : avds[0];
  if (!avd && !dry) {
    console.error(red('No AVD found. Run `npm run emulator:avd` first.'));
    process.exit(1);
  }
  // detached so the emulator window stays open after this script ends (on Windows too).
  const child = background(`Boot emulator ${avd ?? AVD}`, tools.emulator ?? 'emulator', ['-avd', avd ?? AVD, '-netdelay', 'none', '-netspeed', 'full'], { detached: true, stdio: 'ignore' });
  child?.unref();
  step('Wait for the emulator', tools.adb ?? 'adb', ['wait-for-device']);
  if (!dry) {
    process.stdout.write('  waiting for Android to finish booting (the first boot can take a few minutes)');
    for (let i = 0; i < 240; i++) {
      const r = spawnSync(tools.adb, ['shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' });
      if (r.stdout?.trim() === '1') break;
      process.stdout.write('.');
      await sleep(2000);
    }
    console.log('');
  }
  return devices().find((d) => d.startsWith('emulator-')) ?? 'emulator-5554';
}

// Gradle needs the SDK location; write android/local.properties when ANDROID_HOME was not set.
function ensureLocalProperties() {
  const file = path.join(root, 'android', 'local.properties');
  if (!sdk || process.env.ANDROID_HOME || fs.existsSync(file) || dry) return;
  fs.writeFileSync(file, `sdk.dir=${sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}\n`);
  console.log(`\n${green('✓')} Wrote android/local.properties (sdk.dir=${sdk})`);
}

// Bundles the web screens into android/app/src/main/assets, so the APK runs on its own (no dev server).
function bundle() {
  // Demo build: on the device the API defaults to http://10.0.2.2:7341 (the computer's localhost).
  step('Build the app (demo mode)', npm, ['run', 'build'], { cwd: root, env: { ...process.env, VITE_APP_MODE: 'demo' } });
  // CAP_ALLOW_HTTP lets the https WebView call the http demo API; debug builds also allow cleartext to 10.0.2.2.
  step('Copy the build into the Android project', ...cap('sync', 'android'), { cwd: root, env: { ...process.env, CAP_ALLOW_HTTP: '1' } });
  ensureLocalProperties();
}

async function run() {
  if (!dry && !(await doctor({ quiet: true }))) process.exit(1);
  const api = await ensureApi();
  const device = await ensureEmulator();
  bundle();
  step('Build the debug APK (the first build downloads Gradle and takes several minutes)', process.execPath, [path.join(root, 'scripts', 'gradle.mjs'), 'assembleDebug'], { cwd: root, env: buildEnv });
  const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  step('Install on the emulator', tools.adb ?? 'adb', ['-s', device, 'install', '-r', apk]);
  step('Launch EstateFlow', tools.adb ?? 'adb', ['-s', device, 'shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`]);
  if (dry) return console.log(green('\nDry run complete.'));
  console.log(green('\n✓ EstateFlow is open on the emulator. Tap Sign in, then a role under the form to fill a demo login.'));
  if (api) console.log('The demo API keeps running in this window. Press Ctrl+C to stop it (the app then cannot load data).');
}

async function live() {
  if (!dry && !(await doctor({ quiet: true }))) process.exit(1);
  await ensureApi();
  const device = await ensureEmulator();
  if (!(await portAnswers(PORTS.app))) background('Start the app dev server on :7342', npm, ['run', 'dev'], { cwd: root });
  if (!dry) for (let i = 0; i < 30 && !(await portAnswers(PORTS.app)); i++) await sleep(1000);
  ensureLocalProperties();
  // adb reverse maps the device's localhost:7342 to this computer, so the same command works for a USB phone.
  step('Run with live reload', ...cap('run', 'android', '--target', device, '-l', '--host', 'localhost', '--port', String(PORTS.app), '--forwardPorts', `${PORTS.app}:${PORTS.app}`), {
    cwd: root,
    env: { ...buildEnv, CAP_ALLOW_HTTP: '1' },
  });
  if (dry) return console.log(green('\nDry run complete.'));
  console.log(green('\n✓ Live reload is on: edits in src/ appear on the emulator. Ctrl+C stops the servers.'));
}

async function avd() {
  if (!tools.sdkmanager || !tools.avdmanager) {
    await doctor();
    console.error(red('\nemulator:avd needs the Android SDK Command-line Tools (sdkmanager, avdmanager).'));
    if (!dry) process.exit(1);
  }
  if (listAvds().includes(AVD)) {
    console.log(green(`✓ AVD ${AVD} already exists.`));
    return;
  }
  const abi = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
  const api = rest.includes('--api=34') ? 34 : 35;
  const image = `system-images;android-${api};google_apis;${abi}`;
  // sdkmanager and avdmanager are Java tools: give them the same JDK as Gradle.
  step(`Download ${image} (about 1.5 GB; type y and Enter if asked to accept a licence)`, tools.sdkmanager ?? 'sdkmanager', ['--install', image, 'platform-tools', 'emulator'], { env: buildEnv });
  step(`Create ${AVD}`, tools.avdmanager ?? 'avdmanager', ['create', 'avd', '--name', AVD, '--package', image, '--device', 'pixel_7', '--force'], {
    env: buildEnv,
    input: 'no\n',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (dry) return console.log(green('\nDry run complete.'));
  console.log(green(`\n✓ ${AVD} is ready. Run \`npm run android\`.`));
}

// Signed release build for real phones or the Play Store: production web build (no demo mode, https API only).
function release() {
  const arg = rest.find((a) => a.startsWith('--api='));
  const api = (arg ? arg.slice(6) : process.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+/.test(api)) {
    console.error(red('Give the online backend address, which must start with https://, for example:'));
    console.error('  npm run build:release -- --api=https://estateflow-api.onrender.com');
    if (!dry) process.exit(1);
  }
  const props = path.join(root, 'android', 'keystore.properties');
  if (!fs.existsSync(props)) {
    const keytool = java?.home ? `& "${path.join(java.home, 'bin', exe('keytool'))}"` : 'keytool';
    console.error(red('No signing key yet (android/keystore.properties is missing). Create it once:'));
    console.error(`  ${keytool} -genkeypair -v -keystore android/app/estateflow-release.jks -alias estateflow -keyalg RSA -keysize 2048 -validity 10000`);
    console.error('  then create android/keystore.properties with storeFile=estateflow-release.jks, storePassword, keyAlias=estateflow, keyPassword.');
    console.error('  Keep the .jks file and passwords safe: every future update must be signed with the same key.');
    if (!dry) process.exit(1);
  }
  if (!dry && !(java && javaOk(java.version))) {
    console.error(red(`Java 21 is needed for the build (found ${java ? `Java ${java.version}` : 'none'}). Install Temurin 21 or Android Studio.`));
    process.exit(1);
  }
  const env = { ...process.env, VITE_API_URL: api, VITE_APP_MODE: '', CAP_ALLOW_HTTP: '' };
  step(`Build the app for ${api}`, npm, ['run', 'build'], { cwd: root, env });
  step('Copy the build into the Android project', ...cap('sync', 'android'), { cwd: root, env });
  ensureLocalProperties();
  const aab = rest.includes('--aab');
  step(`Build the signed ${aab ? 'app bundle (.aab)' : 'APK'}`, process.execPath, [path.join(root, 'scripts', 'gradle.mjs'), aab ? 'bundleRelease' : 'assembleRelease'], { cwd: root, env: buildEnv });
  const out = aab
    ? path.join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    : path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (dry) return console.log(green('\nDry run complete.'));
  console.log(green(`\n✓ Release ${aab ? 'bundle' : 'APK'}: ${out}`));
  console.log('  Run `npm run build:android` before using the emulator again (this build cannot reach 10.0.2.2).');
}

const commands = {
  release, doctor: async () => process.exit((await doctor()) ? 0 : 1), avd, run, live,
  bundle: () => {
    bundle();
    console.log(green('\n✓ Bundled. In Android Studio open the android folder, pick an emulator and press ▶ Run.'));
    console.log('  Start the backend first (npm run dev in estateflow-backend); the app talks to it at http://10.0.2.2:7341.');
  },
};
if (!commands[cmd]) {
  console.error(`Unknown command "${cmd}". Use one of: ${Object.keys(commands).join(', ')} (add --dry-run to preview).`);
  process.exit(2);
}
if (dry) console.log(yellow('Dry run: commands are printed, not executed.'));
if ((cmd === 'run' || cmd === 'live') && !backend && !(await apiHealthy())) {
  console.error(red('No EstateFlow API on port 7341 and no estateflow-backend folder next to this one.'));
  console.error('Unzip estateflow-backend beside estateflow-app (or set EF_BACKEND_DIR), or start the backend yourself first.');
  if (!dry) process.exit(1);
}
await commands[cmd]();
