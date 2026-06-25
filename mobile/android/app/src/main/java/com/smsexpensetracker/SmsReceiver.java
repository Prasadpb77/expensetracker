package com.smsexpensetracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsReceiver";
    private static final String SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                try {
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
                            
                            // Forward to React Native via event emitter
                            // This will be handled by the SmsModule
                            Intent forwardIntent = new Intent(context, SmsModule.class);
                            forwardIntent.setAction("SMS_DETECTED");
                            forwardIntent.putExtra("sender", sender);
                            forwardIntent.putExtra("body", smsText);
                            context.sendBroadcast(forwardIntent);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing SMS: " + e.getMessage());
                }
            }
        }
    }

    private boolean isBankTransactionSms(String sms) {
        String lower = sms.toLowerCase();
        boolean hasBankKeyword = lower.contains("debited") || lower.contains("credited") ||
                                 lower.contains("paid") || lower.contains("transaction") ||
                                 lower.contains("txn") || lower.contains("upi") ||
                                 lower.contains("bank") || lower.contains("spent") ||
                                 lower.contains("withdrawn") || lower.contains("payment");
        boolean hasAmount = lower.contains("rs.") || lower.contains("inr") ||
                           lower.contains("₹") || lower.matches(".*\\d+[.,]\\d{2}.*");
        return hasBankKeyword && hasAmount;
    }
}