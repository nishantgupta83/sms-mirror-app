package com.smsmirror;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SMSService extends Service {
    private static final String TAG = "SMSService";
    private static final String CHANNEL_ID = "SMSMirrorChannel";
    private static final int NOTIFICATION_ID = 1001;
    private ExecutorService executor;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        executor = Executors.newFixedThreadPool(3);
        Log.d(TAG, "SMS Service Created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "SMS Service Started");
        
        // Start as foreground service
        startForeground(NOTIFICATION_ID, createNotification());
        
        if (intent != null) {
            String sender = intent.getStringExtra("sender");
            String body = intent.getStringExtra("body");
            long timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());
            
            // Process SMS in background thread
            executor.execute(() -> forwardSMSToParent(sender, body, timestamp));
        }
        
        return START_STICKY; // Restart if killed
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (executor != null) {
            executor.shutdown();
        }
        Log.d(TAG, "SMS Service Destroyed");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SMS Mirror Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Monitors and forwards SMS messages");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMS Mirror Active")
            .setContentText("Monitoring messages for safety")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void forwardSMSToParent(String sender, String body, long timestamp) {
        try {
            // Get stored parent device info and API endpoint
            String apiEndpoint = getSharedPreferences("sms_mirror", MODE_PRIVATE)
                .getString("api_endpoint", null);
            String deviceId = getSharedPreferences("sms_mirror", MODE_PRIVATE)
                .getString("device_id", null);
            String parentId = getSharedPreferences("sms_mirror", MODE_PRIVATE)
                .getString("parent_id", null);
            
            if (apiEndpoint == null || deviceId == null || parentId == null) {
                Log.w(TAG, "Missing configuration for SMS forwarding");
                return;
            }

            // Create SMS data JSON
            JSONObject smsData = new JSONObject();
            smsData.put("sender", sender);
            smsData.put("body", body);
            smsData.put("timestamp", timestamp);
            smsData.put("deviceId", deviceId);
            smsData.put("parentId", parentId);
            smsData.put("type", "sms_received");

            // Send to API
            boolean success = sendToAPI(apiEndpoint + "/sms/forward", smsData.toString());
            
            if (success) {
                Log.d(TAG, "SMS forwarded successfully");
            } else {
                Log.w(TAG, "Failed to forward SMS, will retry later");
                // TODO: Store in local queue for retry
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error forwarding SMS: " + e.getMessage());
        }
    }

    private boolean sendToAPI(String endpoint, String jsonData) {
        try {
            URL url = new URL(endpoint);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setDoOutput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            
            // Send data
            OutputStreamWriter writer = new OutputStreamWriter(connection.getOutputStream());
            writer.write(jsonData);
            writer.flush();
            writer.close();
            
            int responseCode = connection.getResponseCode();
            Log.d(TAG, "API Response Code: " + responseCode);
            
            return responseCode >= 200 && responseCode < 300;
            
        } catch (Exception e) {
            Log.e(TAG, "API request failed: " + e.getMessage());
            return false;
        }
    }
}
