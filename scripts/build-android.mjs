import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';

const isWin = process.platform === 'win32';
const androidDir = path.resolve(process.cwd(), 'android');

// Automatically detect JAVA_HOME on Windows if not set
if (isWin && !process.env.JAVA_HOME) {
  const candidateJdks = [

  ];
  for (const candidate of candidateJdks) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'bin', 'javac.exe'))) {
      process.env.JAVA_HOME = candidate;
      process.env.PATH = `${path.join(candidate, 'bin')}${path.delimiter}${process.env.PATH}`;
      console.log(`[build-android] Using Android Studio JBR: ${candidate}`);
      break;
    }
  }
}

// Automatically detect ANDROID_HOME on Windows if not set
if (isWin && !process.env.ANDROID_HOME) {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const candidateSdk = path.join(localAppData, 'Android', 'Sdk');
  if (fs.existsSync(candidateSdk)) {
    process.env.ANDROID_HOME = candidateSdk;
    console.log(`[build-android] Using detected ANDROID_HOME: ${candidateSdk}`);
  }
}

const gradlewCmd = isWin ? 'gradlew.bat' : './gradlew';
const gradleArgs = process.argv.slice(2);
const task = gradleArgs.length > 0 ? gradleArgs : ['assembleDebug'];

console.log(`[build-android] Running gradle ${task.join(' ')} in ${androidDir} using ${gradlewCmd}...`);

const result = spawnSync(gradlewCmd, task, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error('[build-android] Execution error:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Locate generated APK and copy to convenient output locations
const tempDir = process.env.TEMP || process.env.TMP || '/tmp';
const possibleApkLocations = [
  path.join(tempDir, 'havorka_build', 'app', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(androidDir, 'build_out', 'app', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
];

for (const apkPath of possibleApkLocations) {
  if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    console.log(`[build-android] Found APK at ${apkPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    const targetApk = path.join(androidDir, 'app-debug.apk');
    fs.copyFileSync(apkPath, targetApk);
    console.log(`[build-android] Successfully copied APK to ${targetApk}`);
    break;
  }
}
