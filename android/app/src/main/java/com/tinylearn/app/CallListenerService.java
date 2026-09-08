package com.tinylearn.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * "우리가족" 전화 대기용 포어그라운드 서비스.
 *
 * 상시 알림을 띄워 OS 가 프로세스를 함부로 죽이지 못하게 한다.
 * 이렇게 두면 WebView 안의 PeerJS 연결이 백그라운드에서도 살아 있어서
 * 앱을 최소화 상태로 두어도 가족의 전화를 받을 수 있다.
 *
 * 주의: 사용자가 "최근 앱" 목록에서 스와이프해 앱을 완전히 종료하면
 * 액티비티가 파괴되고 WebView 도 함께 죽는다. 부팅/재실행 시에는
 * MainActivity 가 자동으로 이 서비스를 다시 시작한다.
 */
public class CallListenerService extends Service {

    public static final String CHANNEL_ID = "family_call_standby";
    public static final int NOTIF_ID = 42;

    public static final String ACTION_START = "com.tinylearn.app.START_STANDBY";
    public static final String ACTION_STOP = "com.tinylearn.app.STOP_STANDBY";

    private PowerManager.WakeLock wakeLock;

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, CallListenerService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, CallListenerService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            releaseWakeLock();
            return START_NOT_STICKY;
        }

        startForeground(NOTIF_ID, buildNotification());
        acquireWakeLock();
        // 프로세스가 죽어도 OS 가 자동으로 다시 시작하도록.
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 사용자가 최근 앱에서 스와이프해도 서비스는 유지되게.
        // (WebView 는 액티비티와 함께 죽지만, 재실행 시 빠르게 복구)
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
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FamilyCall::Standby");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Throwable ignored) { /* noop */ }
        wakeLock = null;
    }
}
