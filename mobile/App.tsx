// ============================================================
// React Native Mobile Companion App
// Listens to incoming SMS, parses bank transactions,
// and forwards them to the backend via POST request
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  PermissionsAndroid,
  Platform,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { SmsModule } = NativeModules;

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  API_URL: 'https://ntcvlnurhsncllwnxtus.supabase.co/functions/v1/api-sms-receive',
  // Get this from Supabase Dashboard → Settings → API → anon/public key
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY', // Replace with your actual anon key from Supabase Dashboard
  // User ID from your web app (stored after login)
  USER_ID_KEY: '@user_id',
  DEVICE_ID_KEY: '@device_id',
};

// ============================================================
// TYPES
// ============================================================

interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  read: boolean;
}

interface SentTransaction {
  id: string;
  smsBody: string;
  amount: number;
  payee: string;
  bank: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: string;
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<SentTransaction[]>([]);
  const [isListening, setIsListening] = useState(false);

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    initializeApp();
    return () => {
      // Cleanup on unmount
      if (SmsModule && isListening) {
        SmsModule.stopSmsListener();
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Load or create device ID
      let devId = await AsyncStorage.getItem(CONFIG.DEVICE_ID_KEY);
      if (!devId) {
        devId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(CONFIG.DEVICE_ID_KEY, devId);
      }
      setDeviceId(devId);

      // Load user ID (should be set after login from web app)
      const uid = await AsyncStorage.getItem(CONFIG.USER_ID_KEY);
      if (uid) {
        setUserId(uid);
      }

      // Request SMS permissions
      const granted = await requestSmsPermissions();
      setPermissionGranted(granted);

      if (granted && uid) {
        startListening();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize app');
    }
  };

  // ============================================================
  // PERMISSIONS
  // ============================================================

  const requestSmsPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        // Android 13+ (API 33)
        const smsPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission',
            message: 'This app needs SMS permission to read bank transaction messages and automatically log expenses.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return smsPermission === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // Android 12 and below
        const smsPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission',
            message: 'This app needs SMS permission to read bank transaction messages.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const phoneStatePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          {
            title: 'Phone State Permission',
            message: 'Required for SMS detection.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return (
          smsPermission === PermissionsAndroid.RESULTS.GRANTED &&
          phoneStatePermission === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }
    return true; // iOS permissions handled differently
  };

  // ============================================================
  // SMS LISTENER
  // ============================================================

  const startListening = useCallback(() => {
    if (!SmsModule || !userId) return;

    try {
      const eventEmitter = new NativeEventEmitter(SmsModule);

      // Listen for new SMS
      const subscription = eventEmitter.addListener(
        'onSmsReceived',
        async (sms: SmsMessage) => {
          console.log('SMS received:', sms.body);
          await processSms(sms);
        }
      );

      // Start the native SMS listener
      SmsModule.startSmsListener();
      setIsListening(true);

      // Store subscription for cleanup
      return () => subscription.remove();
    } catch (error) {
      console.error('Failed to start SMS listener:', error);
      Alert.alert('Error', 'Failed to start SMS listener. Please restart the app.');
    }
  }, [userId]);

  const stopListening = useCallback(() => {
    if (SmsModule) {
      SmsModule.stopSmsListener();
      setIsListening(false);
    }
  }, []);

  // ============================================================
  // SMS PROCESSING & FORWARDING
  // ============================================================

  const processSms = async (sms: SmsMessage) => {
    if (!userId || !deviceId) return;

    // Basic filter: only process if it looks like a bank transaction
    const isBankSms = /(?:bank|upi|debited|credited|paid|transaction|txn|rs\.?|inr|₹)/i.test(
      sms.body
    );
    if (!isBankSms) return;

    // Skip if already processed (deduplication)
    const alreadyProcessed = recentTransactions.some(
      t => t.smsBody === sms.body && Date.now() - new Date(t.timestamp).getTime() < 60000
    );
    if (alreadyProcessed) return;

    const tempId = `temp_${Date.now()}`;
    const newTransaction: SentTransaction = {
      id: tempId,
      smsBody: sms.body,
      amount: 0,
      payee: 'Processing...',
      bank: sms.address,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    setRecentTransactions(prev => [newTransaction, ...prev].slice(0, 20));

    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          text: sms.body,
          user_id: userId,
          device_id: deviceId,
          received_at: new Date(sms.date).toISOString(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update transaction with parsed data
        setRecentTransactions(prev =>
          prev.map(t =>
            t.id === tempId
              ? {
                  ...t,
                  id: result.transaction.id,
                  amount: result.transaction.amount,
                  payee: result.transaction.payee,
                  bank: result.transaction.bank,
                  status: 'sent' as const,
                }
              : t
          )
        );

        // Show notification
        showNotification(
          'Expense Detected',
          `₹${result.transaction.amount} - ${result.transaction.payee}`
        );
      } else {
        throw new Error(result.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Failed to forward SMS:', error);
      setRecentTransactions(prev =>
        prev.map(t =>
          t.id === tempId ? { ...t, status: 'failed' as const } : t
        )
      );
    }
  };

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  const showNotification = (title: string, message: string) => {
    if (Platform.OS === 'android') {
      // Use Android notification channel
      if (SmsModule) {
        SmsModule.showNotification(title, message);
      }
    } else {
      // iOS - use local notification
      Alert.alert(title, message);
    }
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  const handleSetUserId = async () => {
    // In production, this would come from your auth flow
    const input = prompt('Enter your User ID from web app:');
    if (input) {
      await AsyncStorage.setItem(CONFIG.USER_ID_KEY, input);
      setUserId(input);
      if (permissionGranted) {
        startListening();
      }
    }
  };

  const handleRetryFailed = async (transaction: SentTransaction) => {
    if (!userId || !deviceId) return;

    setRecentTransactions(prev =>
      prev.map(t =>
        t.id === transaction.id ? { ...t, status: 'pending' } : t
      )
    );

    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          text: transaction.smsBody,
          user_id: userId,
          device_id: deviceId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setRecentTransactions(prev =>
          prev.map(t =>
            t.id === transaction.id
              ? {
                  ...t,
                  amount: result.transaction.amount,
                  payee: result.transaction.payee,
                  status: 'sent',
                }
              : t
          )
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setRecentTransactions(prev =>
        prev.map(t =>
          t.id === transaction.id ? { ...t, status: 'failed' } : t
        )
      );
    }
  };

  const renderTransaction = ({ item }: { item: SentTransaction }) => {
    const statusColor =
      item.status === 'sent'
        ? '#10b981'
        : item.status === 'failed'
        ? '#ef4444'
        : '#f59e0b';

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <Text style={styles.bankName}>{item.bank}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
        <Text style={styles.payee}>{item.payee}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        {item.status === 'failed' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => handleRetryFailed(item)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SMS Expense Tracker</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isListening ? '#10b981' : '#ef4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {isListening ? 'Listening' : 'Stopped'}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>User ID:</Text>
        <Text style={styles.infoValue}>{userId || 'Not set'}</Text>
        <TouchableOpacity style={styles.setButton} onPress={handleSetUserId}>
          <Text style={styles.setButtonText}>
            {userId ? 'Change' : 'Set User ID'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>SMS Permission:</Text>
        <Text
          style={[
            styles.infoValue,
            { color: permissionGranted ? '#10b981' : '#ef4444' },
          ]}
        >
          {permissionGranted ? 'Granted ✓' : 'Denied ✗'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.sectionCount}>{recentTransactions.length}</Text>
      </View>

      <FlatList
        data={recentTransactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No transactions yet.{'\n'}
              Make a payment and wait for the SMS!
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Automatically forwards bank SMS to your expense tracker
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  setButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  setButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bankName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 4,
  },
  payee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
  retryButton: {
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
});