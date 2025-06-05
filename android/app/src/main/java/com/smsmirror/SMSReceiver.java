package com.smsmirror;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SMSReceiver extends BroadcastReceiver {
    private static final String TAG = "SMSReceiver";
    private static final String SMS_RECEIVED_EVENT = "smsReceived";
    private ReactApplicationContext reactContext;

    public SMSReceiver() {
        super();
    }

    public SMSReceiver(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "SMS Received!");
        
        try {
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                Object[] pdus = (Object[]) bundle.get("pdus");
                String format = bundle.getString("format");
                
                if (pdus != null) {
                    for (Object pdu : pdus) {
                        SmsMessage smsMessage = SmsMessage.createFromPdu(
                            (byte[]) pdu, format
                        );
                        
                        if (smsMessage != null) {
                            processSMS(context, smsMessage);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing SMS: " + e.getMessage());
        }
    }

    private void processSMS(Context context, SmsMessage smsMessage) {
        try {
            String sender = smsMessage.getDisplayOriginatingAddress();
            String messageBody = smsMessage.getMessageBody();
            long timestamp = smsMessage.getTimestampMillis();
            
            // Create message data
            WritableMap messageData = Arguments.createMap();
            messageData.putString("sender", sender);
            messageData.putString("body", messageBody);
            messageData.putDouble("timestamp", timestamp);
            messageData.putString("date", formatDate(timestamp));
            messageData.putString("type", "received");
            
            Log.d(TAG, "SMS Data: " + sender + " - " + messageBody);
            
            // Send to React Native
            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(SMS_RECEIVED_EVENT, messageData);
            }
            
            // Start background service to handle SMS forwarding
            Intent serviceIntent = new Intent(context, SMSService.class);
            serviceIntent.putExtra("sender", sender);
            serviceIntent.putExtra("body", messageBody);
            serviceIntent.putExtra("timestamp", timestamp);
            context.startForegroundService(serviceIntent);
            
        } catch (Exception e) {
            Log.e(TAG, "Error processing SMS message: " + e.getMessage());
        }
    }

    private String formatDate(long timestamp) {
        SimpleDateFormat sdf = new SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault());
        return sdf.format(new Date(timestamp));
    }

    public static void setReactContext(ReactApplicationContext context) {
        // This will be called from the React Native module
    }
}
