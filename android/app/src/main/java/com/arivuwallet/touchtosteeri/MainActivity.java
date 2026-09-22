package com.arivuwallet.touchtosteeri;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import androidx.annotation.NonNull;

import java.util.HashMap;
import java.util.Map;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.EventChannel;
import io.flutter.plugin.common.MethodChannel;

public class MainActivity extends FlutterActivity implements EventChannel.StreamHandler, SensorEventListener {
    private static final String SENSOR_CHANNEL = "touch_to_steer/gyroscope";
    private static final String SETTINGS_CHANNEL = "touch_to_steer/settings";
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private EventChannel.EventSink sensorSink;
    private final float[] rotationMatrix = new float[9];
    private final float[] orientation = new float[3];

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);

        new EventChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), SENSOR_CHANNEL)
                .setStreamHandler(this);

        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), SETTINGS_CHANNEL)
                .setMethodCallHandler((call, result) -> {
                    SharedPreferences prefs = getSharedPreferences("touch_to_steer", MODE_PRIVATE);
                    if ("load".equals(call.method)) {
                        result.success(prefs.getString("json", "{}"));
                    } else if ("save".equals(call.method)) {
                        String json = call.arguments == null ? "{}" : call.arguments.toString();
                        prefs.edit().putString("json", json).apply();
                        result.success(null);
                    } else {
                        result.notImplemented();
                    }
                });
    }

    @Override
    public void onListen(Object arguments, EventChannel.EventSink events) {
        sensorSink = events;
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (rotationSensor == null) {
            rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        }
        if (rotationSensor != null) {
            sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
        }
    }

    @Override
    public void onCancel(Object arguments) {
        stopSensor();
        sensorSink = null;
    }

    private void stopSensor() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (sensorSink == null) return;
        int type = event.sensor.getType();
        if (type != Sensor.TYPE_GAME_ROTATION_VECTOR && type != Sensor.TYPE_ROTATION_VECTOR) return;

        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
        SensorManager.getOrientation(rotationMatrix, orientation);

        Map<String, Double> values = new HashMap<>();
        values.put("azimuth", (double) orientation[0]);
        values.put("pitch", (double) orientation[1]);
        values.put("roll", (double) orientation[2]);
        sensorSink.success(values);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No-op.
    }

    @Override
    protected void onDestroy() {
        stopSensor();
        super.onDestroy();
    }
}
