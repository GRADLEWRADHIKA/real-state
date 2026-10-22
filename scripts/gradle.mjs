// Runs the Android Gradle wrapper on any OS: gradlew.bat on Windows, ./gradlew elsewhere.
// Usage: node scripts/gradle.mjs assembleDebug
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const windows = process.platform === 'win32';
const cwd = path.join(import.meta.dirname, '..', 'android');
// `sh ./gradlew` works even when unzipping dropped the file's executable bit.
// Full path on Windows: cmd may be set not to look in the current folder (NoDefaultCurrentDirectoryInExePath).
const [cmd, args] = windows ? [`"${path.join(cwd, 'gradlew.bat')}"`, process.argv.slice(2)] : ['sh', ['./gradlew', ...process.argv.slice(2)]];
const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: windows });
if (result.error) console.error(`Could not run the Gradle wrapper: ${result.error.message}`);
process.exit(result.status ?? 1);
