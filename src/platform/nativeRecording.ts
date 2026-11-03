import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AudioFocusEvent {
  type: 'loss' | 'loss_transient' | 'can_duck' | 'gain';
  canDuck: boolean;
}

export interface RecordingPermissionsResult {
  audioGranted: boolean;
  notificationsGranted: boolean;
}

export interface RecordingBridgePluginInterface {
  startService(): Promise<{ started: boolean; notificationsGranted: boolean }>;
  stopService(): Promise<{ stopped: boolean }>;
  checkRecordingPermissions(): Promise<RecordingPermissionsResult>;
  openAppSettings(): Promise<void>;
  addListener(
    eventName: 'audioFocusChanged',
    listenerFunc: (event: AudioFocusEvent) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const RecordingBridge = registerPlugin<RecordingBridgePluginInterface>('RecordingBridge');

export function isCapacitorAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Starts Android Foreground Service with microphone type and persistent notification
 */
export async function startNativeForegroundService(): Promise<{ started: boolean; notificationsGranted: boolean }> {
  if (!isCapacitorAndroid()) {
    return { started: false, notificationsGranted: true };
  }
  return await RecordingBridge.startService();
}

/**
 * Stops Android Foreground Service
 */
export async function stopNativeForegroundService(): Promise<{ stopped: boolean }> {
  if (!isCapacitorAndroid()) {
    return { stopped: false };
  }
  return await RecordingBridge.stopService();
}

/**
 * Checks runtime permissions status on Android
 */
export async function checkNativeRecordingPermissions(): Promise<RecordingPermissionsResult> {
  if (!isCapacitorAndroid()) {
    return { audioGranted: true, notificationsGranted: true };
  }
  return await RecordingBridge.checkRecordingPermissions();
}

/**
 * Opens system application details settings page
 */
export async function openNativeAppSettings(): Promise<void> {
  if (!isCapacitorAndroid()) return;
  await RecordingBridge.openAppSettings();
}

/**
 * Registers a listener for Android AudioFocus changes (e.g. phone calls, alarms)
 */
export async function addAudioFocusListener(
  callback: (event: AudioFocusEvent) => void
): Promise<{ remove: () => Promise<void> }> {
  if (!isCapacitorAndroid()) {
    return { remove: async () => {} };
  }
  return await RecordingBridge.addListener('audioFocusChanged', callback);
}
