package com.etnofield.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "RecordingBridge",
    permissions = {
        @Permission(
            strings = { Manifest.permission.RECORD_AUDIO },
            alias = "recordAudio"
        ),
        @Permission(
            strings = { "android.permission.POST_NOTIFICATIONS" },
            alias = "postNotifications"
        )
    }
)
public class RecordingBridgePlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        RecordingService.setAudioFocusListener(new RecordingService.AudioFocusListener() {
            @Override
            public void onAudioFocusChanged(String type, boolean canDuck) {
                JSObject data = new JSObject();
                data.put("type", type);
                data.put("canDuck", canDuck);
                notifyListeners("audioFocusChanged", data);
            }
        });
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();

        // 1. Check RECORD_AUDIO runtime permission
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("RECORD_AUDIO_NOT_GRANTED", "Разрешение на доступ к микрофону не предоставлено");
            return;
        }

        // 2. Check POST_NOTIFICATIONS status (Android 13+)
        boolean notificationsGranted = true;
        if (Build.VERSION.SDK_INT >= 33) {
            notificationsGranted = ContextCompat.checkSelfPermission(
                context, 
                "android.permission.POST_NOTIFICATIONS"
            ) == PackageManager.PERMISSION_GRANTED;
        }

        try {
            Intent intent = new Intent(context, RecordingService.class);
            intent.setAction(RecordingService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }

            JSObject res = new JSObject();
            res.put("started", true);
            res.put("notificationsGranted", notificationsGranted);
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("SERVICE_START_FAILED", "Не удалось запустить foreground-службу записи: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, RecordingService.class);
            intent.setAction(RecordingService.ACTION_STOP);
            context.startService(intent);

            JSObject res = new JSObject();
            res.put("stopped", true);
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("SERVICE_STOP_FAILED", "Не удалось остановить foreground-службу: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void checkRecordingPermissions(PluginCall call) {
        Context context = getContext();
        boolean audioGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean notificationsGranted = true;
        if (Build.VERSION.SDK_INT >= 33) {
            notificationsGranted = ContextCompat.checkSelfPermission(
                context, 
                "android.permission.POST_NOTIFICATIONS"
            ) == PackageManager.PERMISSION_GRANTED;
        }

        JSObject res = new JSObject();
        res.put("audioGranted", audioGranted);
        res.put("notificationsGranted", notificationsGranted);
        call.resolve(res);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", context.getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            call.reject("OPEN_SETTINGS_FAILED", ex.getMessage(), ex);
        }
    }
}
