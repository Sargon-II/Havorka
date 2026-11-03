package com.havorka.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class RecordingService extends Service {
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String CHANNEL_ID = "havorka_recording_channel";
    public static final int NOTIFICATION_ID = 40401;

    private static AudioFocusListener sAudioFocusListener;
    private AudioManager mAudioManager;
    private AudioFocusRequest mAudioFocusRequest;
    private boolean mHasAudioFocus = false;

    public interface AudioFocusListener {
        void onAudioFocusChanged(String type, boolean canDuck);
    }

    public static void setAudioFocusListener(AudioFocusListener listener) {
        sAudioFocusListener = listener;
    }

    private final AudioManager.OnAudioFocusChangeListener mFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            if (sAudioFocusListener == null) return;

            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_LOSS:
                    mHasAudioFocus = false;
                    sAudioFocusListener.onAudioFocusChanged("loss", false);
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    mHasAudioFocus = false;
                    sAudioFocusListener.onAudioFocusChanged("loss_transient", false);
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    // Short notification sound - do not interrupt recording
                    sAudioFocusListener.onAudioFocusChanged("can_duck", true);
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    mHasAudioFocus = true;
                    sAudioFocusListener.onAudioFocusChanged("gain", false);
                    break;
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        mAudioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopRecordingService();
            return START_NOT_STICKY;
        }

        startInForeground();
        requestAudioFocus();
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Запись интервью",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Уведомление активной аудиозаписи полевого интервью");
            channel.enableVibration(false);
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startInForeground() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Havorka")
            .setContentText("Идёт запись интервью")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void requestAudioFocus() {
        if (mAudioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();

            mAudioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(mFocusChangeListener)
                .build();

            int res = mAudioManager.requestAudioFocus(mAudioFocusRequest);
            mHasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        } else {
            int res = mAudioManager.requestAudioFocus(
                mFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
            mHasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        }
    }

    private void abandonAudioFocus() {
        if (mAudioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (mAudioFocusRequest != null) {
                mAudioManager.abandonAudioFocusRequest(mAudioFocusRequest);
                mAudioFocusRequest = null;
            }
        } else {
            mAudioManager.abandonAudioFocus(mFocusChangeListener);
        }
        mHasAudioFocus = false;
    }

    private void stopRecordingService() {
        abandonAudioFocus();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopRecordingService();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
