package com.tinylearn.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * "우리가족" 전화 대기용 포어그라운드 서비스.
 *
 * 상시 알림을 띄워 OS 가 프로세스를 함부로 죽이지 못하게 한다.
 * 이렇게 두면 WebView 안의 PeerJS 연결이 백그라운드에서도 살아 있어서
 * 앱을 최소화 상태로 두어도 가족의 전화를 받을 수 있다.
 *
 * API 34+: foregroundServiceType=dataSync 로 선언.
 * (phoneCall 은 Telecom ConnectionService 와 연동되어야 쓸 수 있고,
 *  연동 없이 시작하면 ForegroundServiceStartNotAllowedException 발생.)
 */
public class CallListenerService extends Service {

    private static final String TAG = "FamilyCallStandby";

    public static final String CHANNEL_ID = "family_call_standby";
    public static final int NOTIF_ID = 42;

    public static final String ACTION_START = "com.tinylearn.app.START_STANDBY";
    public static final String ACTION_STOP = "com.tinylearn.app.STOP_STANDBY";

    private PowerManager.WakeLock wakeLock;

    public static void start(Context ctx) {
        try {
            Intent i = new Intent(ctx, CallListenerService.class).setAction(ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Throwable t) {
            // OS 가 백그라운드에서의 시작을 거부해도 앱이 죽지 않도록.
            Log.w(TAG, "startForegroundService failed", t);
        }
    }

    public static void stop(Context ctx) {
        try {
            ctx.stopService(new Intent(ctx, CallListenerService.class));
        } catch (Throwable t) {
            Log.w(TAG, "stopService failed", t);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForegroundCompat();
            stopSelf();
            releaseWakeLock();
            return START_NOT_STICKY;
        }

        try {
            Notification n = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // API 29+ 는 startForeground 에 type 전달 가능. API 34+ 는 manifest 와 일치해야 함.
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIF_ID, n);
            }
            acquireWakeLock();
        } catch (Throwable t) {
            // startForeground 실패 시 (권한/정책) 앱을 죽이지 말고 조용히 종료.
            Log.e(TAG, "startForeground failed; stopping service", t);
            stopSelf();
            return START_NOT_STICKY;
        }
        // 프로세스가 죽어도 OS 가 자동으로 다시 시작하도록.
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void stopForegroundCompat() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(Service.STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Throwable t) {
            Log.w(TAG, "stopForeground failed", t);
        }
    }

    private Notification buildNotification() {
        Intent tap = new Intent(this, MainActivity.class);
        tap.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, tap,
                PendingIntent.FLAG_UPDATE_CURRENT |
                        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                                ? PendingIntent.FLAG_IMMUTABLE : 0));

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_standby)
                .setContentTitle("우리가족")
                .setContentText("가족의 전화를 기다리고 있어요")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pi)
                .setShowWhen(false)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "전화 대기",
                    NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("가족의 전화를 받기 위해 앱을 켜둔 상태로 유지합니다.");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        }
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) return;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FamilyCall::Standby");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
        } catch (Throwable t) {
            Log.w(TAG, "acquireWakeLock failed", t);
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Throwable ignored) { /* noop */ }
        wakeLock = null;
    }
}
