import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';

const isWin = process.platform === 'win32';
const androidDir = path.resolve(process.cwd(), 'android');

// Ensure JDK from environment is on PATH if JAVA_HOME is set
if (process.env.JAVA_HOME) {
  const javaBin = path.join(process.env.JAVA_HOME, 'bin');
  if (!process.env.PATH?.includes(javaBin)) {
    process.env.PATH = `${javaBin}${path.delimiter}${process.env.PATH || ''}`;
  }
} else if (isWin) {
  // Fallback detection on Windows when JAVA_HOME is not explicitly set in the shell
  const programFiles = process.env.ProgramFiles;
  if (programFiles) {
    const defaultJbr = path.join(programFiles, 'Android', 'Android Studio', 'jbr');
    if (fs.existsSync(defaultJbr) && fs.existsSync(path.join(defaultJbr, 'bin', 'javac.exe'))) {
      process.env.JAVA_HOME = defaultJbr;
      process.env.PATH = `${path.join(defaultJbr, 'bin')}${path.delimiter}${process.env.PATH || ''}`;
      console.log(`[build-android] Using detected Android Studio JBR: ${defaultJbr}`);
    }
  }
}

// Fallback detection on Windows when ANDROID_HOME is not explicitly set
if (isWin && !process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const defaultSdk = path.join(localAppData, 'Android', 'Sdk');
    if (fs.existsSync(defaultSdk)) {
      process.env.ANDROID_HOME = defaultSdk;
      console.log(`[build-android] Using detected ANDROID_HOME: ${defaultSdk}`);
    }
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

// Locate generated APK and copy to root android directory for convenience
const possibleApkLocations = [
  path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(androidDir, 'build_out', 'app', 'outputs', 'apk', 'debug', 'app-debug.apk'),
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
