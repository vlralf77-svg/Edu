package com.tinylearn.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * 부팅 시 대기 모드가 켜져 있던 유저라면 서비스 자동 시작.
 * SharedPreferences 로 상태를 저장/복원.
 */
public class BootReceiver extends BroadcastReceiver {

    public static final String PREFS = "family_call_prefs";
    public static final String KEY_STANDBY = "standby_enabled";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
            return;
        }
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (p.getBoolean(KEY_STANDBY, false)) {
            CallListenerService.start(ctx);
        }
    }
}
