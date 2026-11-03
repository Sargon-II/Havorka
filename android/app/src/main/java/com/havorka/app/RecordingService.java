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
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class RecordingService extends Service {
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String CHANNEL_ID = "havorka_recording_channel";
    public static final int NOTIFICATION_ID = 40401;

    private static RecordingService sInstance;
    private static AudioFocusListener sAudioFocusListener;

    private AudioManager mAudioManager;
    private AudioFocusRequest mAudioFocusRequest;
    private boolean mHasAudioFocus = false;

    // Native MediaRecorder state for Step 6 (AAC in m4a with rotation)
    private MediaRecorder mMediaRecorder;
    private File mCurrentRecordingFile;
    private int mCurrentPartNumber = 1;
    private String mSessionBaseName = "field_record";
    private boolean mIsNativeRecording = false;
    private final List<String> mRecordedFiles = new ArrayList<>();

    public interface AudioFocusListener {
        void onAudioFocusChanged(String type, boolean canDuck);
    }

    public static void setAudioFocusListener(AudioFocusListener listener) {
        sAudioFocusListener = listener;
    }

    public static RecordingService getInstance() {
        return sInstance;
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
        sInstance = this;
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

    /**
     * Requirement 6: Native MediaRecorder writing AAC in m4a container with file rotation.
     * Each rotated file is a standalone, valid m4a audio file.
     */
    public synchronized boolean startNativeMediaRecording(String baseName) {
        mSessionBaseName = (baseName != null && !baseName.trim().isEmpty())
            ? baseName.trim()
            : "recording_" + System.currentTimeMillis();
        mCurrentPartNumber = 1;
        mRecordedFiles.clear();
        return startRecorderForPart(mCurrentPartNumber);
    }

    private synchronized boolean startRecorderForPart(int partNumber) {
        stopCurrentRecorder();
        try {
            File outputDir = getExternalFilesDir(android.os.Environment.DIRECTORY_MUSIC);
            if (outputDir == null) {
                outputDir = getFilesDir();
            }
            if (!outputDir.exists()) {
                outputDir.mkdirs();
            }

            mCurrentRecordingFile = new File(outputDir, mSessionBaseName + "_часть" + partNumber + ".m4a");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                mMediaRecorder = new MediaRecorder(this);
            } else {
                mMediaRecorder = new MediaRecorder();
            }

            mMediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mMediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mMediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mMediaRecorder.setAudioSamplingRate(44100);
            mMediaRecorder.setAudioEncodingBitRate(128000);
            mMediaRecorder.setOutputFile(mCurrentRecordingFile.getAbsolutePath());

            mMediaRecorder.prepare();
            mMediaRecorder.start();
            mIsNativeRecording = true;
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            stopCurrentRecorder();
            return false;
        }
    }

    public synchronized String rotateNativeFile() {
        if (!mIsNativeRecording || mMediaRecorder == null) {
            return null;
        }
        String completedFilePath = mCurrentRecordingFile != null ? mCurrentRecordingFile.getAbsolutePath() : null;
        if (completedFilePath != null) {
            mRecordedFiles.add(completedFilePath);
        }

        mCurrentPartNumber++;
        boolean ok = startRecorderForPart(mCurrentPartNumber);
        return ok ? completedFilePath : null;
    }

    public synchronized List<String> stopNativeMediaRecording() {
        if (mCurrentRecordingFile != null && mIsNativeRecording) {
            mRecordedFiles.add(mCurrentRecordingFile.getAbsolutePath());
        }
        stopCurrentRecorder();
        mIsNativeRecording = false;
        return new ArrayList<>(mRecordedFiles);
    }

    private synchronized void stopCurrentRecorder() {
        if (mMediaRecorder != null) {
            try {
                mMediaRecorder.stop();
            } catch (Exception ignored) {}
            try {
                mMediaRecorder.release();
            } catch (Exception ignored) {}
            mMediaRecorder = null;
        }
    }

    public boolean isNativeRecording() {
        return mIsNativeRecording;
    }

    public List<String> getRecordedFiles() {
        return new ArrayList<>(mRecordedFiles);
    }

    private void stopRecordingService() {
        stopNativeMediaRecording();
        abandonAudioFocus();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (sInstance == this) {
            sInstance = null;
        }
        stopRecordingService();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
