package com.tinylearn.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS ↔ 네이티브 브리지.
 *
 * - enable() : 포어그라운드 대기 서비스 시작 + 배터리 최적화 예외 요청
 * - disable(): 서비스 종료
 * - isEnabled(): 저장된 상태 조회
 * - isIgnoringBatteryOptimizations(): 배터리 최적화 예외 여부
 * - requestIgnoreBatteryOptimizations(): 시스템 다이얼로그 요청
 */
@CapacitorPlugin(name = "KeepAlive")
public class KeepAlivePlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences p = ctx.getSharedPreferences(BootReceiver.PREFS, Context.MODE_PRIVATE);
        p.edit().putBoolean(BootReceiver.KEY_STANDBY, true).apply();
        CallListenerService.start(ctx);

        JSObject ret = new JSObject();
        ret.put("enabled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences p = ctx.getSharedPreferences(BootReceiver.PREFS, Context.MODE_PRIVATE);
        p.edit().putBoolean(BootReceiver.KEY_STANDBY, false).apply();
        CallListenerService.stop(ctx);

        JSObject ret = new JSObject();
        ret.put("enabled", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        SharedPreferences p = getContext()
                .getSharedPreferences(BootReceiver.PREFS, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("enabled", p.getBoolean(BootReceiver.KEY_STANDBY, false));
        call.resolve(ret);
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
            call.resolve();
        } catch (Throwable t) {
            // 사용자 기기가 해당 인텐트를 지원하지 않는 경우 배터리 설정 화면으로 폴백.
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Throwable t2) {
                call.reject("배터리 최적화 예외 요청을 열 수 없습니다.");
            }
        }
    }
}
