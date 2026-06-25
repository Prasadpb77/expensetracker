package com.smsexpensetracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.telephony.SmsMessage;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SmsModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SmsModule";
    private static final String CHANNEL_ID = "SmsExpenseTracker";
    private static final int NOTIFICATION_ID = 1001;
    private final ReactApplicationContext reactContext;
    private BroadcastReceiver smsReceiver;
    private boolean isListening = false;

    public SmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        createNotificationChannel();
    }

    @Override
    public String getName() {
        return "SmsModule";
    }

    // ============================================================
    // NOTIFICATION CHANNEL
    // ============================================================

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Expense Tracker",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Shows when bank SMS is detected");
            NotificationManager manager = reactContext.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    // ============================================================
    // START SMS LISTENER
    // ============================================================

    @ReactMethod
    public void startSmsListener() {
        if (isListening) {
            Log.d(TAG, "SMS listener already running");
            return;
        }

        Log.d(TAG, "Starting SMS listener...");

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent.getAction() != null && intent.getAction().equals("android.provider.Telephony.SMS_RECEIVED")) {
                    Bundle bundle = intent.getExtras();
                    if (bundle != null) {
                        Object[] pdus = (Object[]) bundle.get("pdus");
                        if (pdus != null && pdus.length > 0) {
                            StringBuilder smsBody = new StringBuilder();
                            String sender = "";

                            for (Object pdu : pdus) {
                                SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                                smsBody.append(smsMessage.getMessageBody());
                                sender = smsMessage.getOriginatingAddress();
                            }

                            String smsText = smsBody.toString();
                            Log.d(TAG, "SMS received from: " + sender);
                            Log.d(TAG, "SMS body: " + smsText);

                            // Check if it's a bank transaction SMS
                            if (isBankTransactionSms(smsText)) {
                                Log.d(TAG, "Bank SMS detected!");
                                sendSmsToReact(sender, smsText);
                                showNotification("Expense Detected", smsText);
                            }
                        }
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
        reactContext.registerReceiver(smsReceiver, filter);
        isListening = true;
        Log.d(TAG, "SMS listener started");
    }

    // ============================================================
    // STOP SMS LISTENER
    // ============================================================

    @ReactMethod
    public void stopSmsListener() {
        if (smsReceiver != null && isListening) {
            try {
                reactContext.unregisterReceiver(smsReceiver);
                isListening = false;
                Log.d(TAG, "SMS listener stopped");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping SMS listener: " + e.getMessage());
            }
        }
    }

    // ============================================================
    // BANK SMS DETECTION
    // ============================================================

    private boolean isBankTransactionSms(String sms) {
        String lower = sms.toLowerCase();
        // Check for bank keywords and amount patterns
        boolean hasBankKeyword = lower.contains("debited") || lower.contains("credited") ||
                                 lower.contains("paid") || lower.contains("transaction") ||
                                 lower.contains("txn") || lower.contains("upi") ||
                                 lower.contains("bank") || lower.contains("spent") ||
                                 lower.contains("withdrawn") || lower.contains("payment");

        boolean hasAmount = lower.contains("rs.") || lower.contains("inr") ||
                           lower.contains("₹") || lower.matches(".*\\d+[.,]\\d{2}.*");

        return hasBankKeyword && hasAmount;
    }

    // ============================================================
    // SEND SMS TO REACT NATIVE
    // ============================================================

    private void sendSmsToReact(String sender, String smsBody) {
        WritableMap params = Arguments.createMap();
        params.putString("address", sender);
        params.putString("body", smsBody);
        params.putDouble("date", System.currentTimeMillis());
        params.putBoolean("read", true);

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onSmsReceived", params);
    }

    // ============================================================
    // SHOW NOTIFICATION
    // ============================================================

    @ReactMethod
    public void showNotification(String title, String message) {
        NotificationManager manager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

        // Intent to open app when notification is tapped
        Intent intent = reactContext.getPackageManager()
            .getLaunchIntentForPackage(reactContext.getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            reactContext, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(reactContext, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();

        manager.notify(NOTIFICATION_ID, notification);
    }

    // ============================================================
    // CLEANUP
    // ============================================================

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        stopSmsListener();
    }
}