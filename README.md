# Expense Tracker - Automated SMS Expense Tracking System

A complete automated expense tracking system that detects bank SMS transactions and pushes real-time notifications to approve/ignore expenses.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED EXPENSE TRACKING FLOW               │
└─────────────────────────────────────────────────────────────────┘

  [Bank SMS] 
       │
       ▼
  [Android SMS Receiver] ──► [React Native App]
       │                           │
       │                           ▼
       │                    [POST /api/v1/sms/receive]
       │                           │
       ▼                           ▼
  [Supabase Edge Function] ◄── [Parse SMS + Extract Amount]
       │
       ▼
  [Store in sms_transactions table]
       │
       ▼
  [Push to notifications table]
       │
       ▼
  [Web App - Real-time Polling / Realtime Channel]
       │
       ▼
  [SmsApprovalModal pops up]
       │
       ├──► [Ignore] ──► Mark as rejected
       │
       └──► [Add Expense] ──► Create expense + Mark as approved
```

## 📦 Deliverables

### 1. Backend - Supabase Edge Function
**File:** `supabase/functions/api-sms-receive/index.ts`

- **Endpoint:** `POST /api/v1/sms/receive`
- **Purpose:** Accepts raw SMS text from mobile app, parses it using regex, stores in database, pushes notification
- **Features:**
  - Multi-bank regex patterns (HDFC, SBI, ICICI, Axis, UPI, generic)
  - Extracts: amount, payee, bank, UPI reference
  - Confidence scoring (high/medium/low)
  - Real-time push via Supabase Realtime broadcast
  - Stores in `sms_transactions` and `notifications` tables

### 2. Database Schema
**File:** `supabase/sql/supabase-sms-schema.sql`

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Creates 2 tables:
-- 1. sms_transactions - logs every incoming SMS with parsed data
-- 2. notifications - for poll-based notification delivery

-- Enables RLS, indexes, and realtime
```

**Tables:**
- `sms_transactions`: id, user_id, raw_text, amount, payee, bank, upi_ref, confidence, status, category, payment_method, expense_id, device_id, timestamps
- `notifications`: id, user_id, type, title, message, data (JSONB), is_read, created_at

### 3. Frontend - React Hook
**File:** `src/hooks/useSmsNotifications.ts`

- **Purpose:** Listens for real-time SMS transaction notifications
- **Features:**
  - Polls `notifications` table every 5 seconds
  - Listens to Supabase Realtime channel `sms-transaction-{user_id}`
  - Auto-shows modal when new transaction detected
  - Marks notifications as read
  - Returns: `pendingTransaction`, `showModal`, `dismissTransaction`, `markAsRead`

### 4. Frontend - Approval Modal
**File:** `src/components/ui/SmsApprovalModal.tsx`

- **Purpose:** Beautiful notification card with pre-filled transaction details
- **Features:**
  - Shows: Amount (large), Payee, Bank, UPI Ref, Detection time
  - Category picker (dropdown with icons)
  - Payment method picker (Personal, Joint Account, Credit Card)
  - "Ignore" button - marks as rejected
  - "Add Expense" button - creates expense and marks as approved
  - Gradient header with animated bell icon
  - Fully typed with TypeScript

### 5. Frontend - Layout Integration
**File:** `src/components/layout/Layout.tsx`

- Wires `useSmsNotifications` hook
- Renders `SmsApprovalModal` when `showModal` is true
- Works globally on all pages

### 6. Mobile App - React Native
**File:** `mobile/App.tsx`

- **Purpose:** Lightweight companion app that runs on user's phone
- **Features:**
  - Requests SMS permissions (Android 13+ compatible)
  - Listens for incoming SMS via native module
  - Filters bank transaction SMS
  - Deduplicates (skips if same SMS within 60s)
  - Forwards to backend via POST request
  - Shows local notification when expense detected
  - Displays recent transactions list
  - Retry failed transactions

### 7. Android Native Module
**Files:**
- `mobile/android/app/src/main/java/com/smsexpensetracker/SmsModule.java` - React Native bridge
- `mobile/android/app/src/main/java/com/smsexpensetracker/SmsPackage.java` - Package registration
- `mobile/android/app/src/main/java/com/smsexpensetracker/SmsReceiver.java` - Background SMS receiver
- `mobile/android/app/src/main/java/com/smsexpensetracker/MainApplication.java` - App configuration
- `mobile/android/app/src/main/AndroidManifest.xml` - Permissions & receiver registration

**Features:**
- BroadcastReceiver for `SMS_RECEIVED` intent
- High priority (999) to receive SMS before other apps
- Bank SMS detection in native code
- Emits events to React Native
- Shows Android notifications
- Creates notification channel (Android 8+)

## 🚀 Setup Instructions

### Backend Setup

1. **Run the SQL schema:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents of `supabase/sql/supabase-sms-schema.sql`
   - Execute to create tables

2. **Deploy the Edge Function:**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login
   supabase login
   
   # Link project
   supabase link --project-ref ntcvlnurhsncllwnxtus
   
   # Deploy function
   supabase functions deploy api-sms-receive --file supabase/functions/api-sms-receive/index.ts
   ```

3. **Set environment variables:**
   - In Supabase Dashboard → Edge Functions → api-sms-receive → Settings
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)
   - Your project URL: `https://ntcvlnurhsncllwnxtus.supabase.co`

### Frontend Setup

The frontend is already integrated! Just ensure:

1. **Dependencies installed:**
   ```bash
   npm install
   ```

2. **Environment variables:**
   - `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

3. **Run the app:**
   ```bash
   npm run dev
   ```

The `SmsApprovalModal` will automatically appear when a bank SMS is detected via the `useSmsNotifications` hook.

### Mobile App Setup

1. **Initialize React Native project:**
   ```bash
   npx react-native init SmsExpenseTracker --template react-native-template-typescript
   cd SmsExpenseTracker
   ```

2. **Install dependencies:**
   ```bash
   npm install @react-native-async-storage/async-storage
   ```

3. **Copy files:**
   - Copy `mobile/App.tsx` to `App.tsx`
   - Copy Android native files to `android/app/src/main/java/com/smsexpensetracker/`
   - Copy `AndroidManifest.xml` to `android/app/src/main/`

4. **Update configuration:**
   - Edit `mobile/App.tsx`:
     - Set `API_URL` to your Supabase Edge Function URL
     - Set `SUPABASE_ANON_KEY` to your Supabase anon key

5. **Build and run:**
   ```bash
   npx react-native run-android
   ```

## 🔧 How It Works

### End-to-End Flow

1. **User makes a payment** via UPI/bank
2. **Bank sends SMS** to user's phone
3. **Android SMS Receiver** (native) detects the SMS
4. **React Native app** receives the SMS via event emitter
5. **App filters** for bank transaction keywords
6. **App POSTs** to `/api/v1/sms/receive` with:
   ```json
   {
     "text": "₹500 paid to Rahul Kumar. UPI: 123456789012",
     "user_id": "user-uuid",
     "device_id": "device_123"
   }
   ```
7. **Edge Function** parses SMS using regex:
   - Extracts amount: ₹500
   - Extracts payee: Rahul Kumar
   - Extracts bank: UPI Payment
   - Extracts UPI ref: 123456789012
8. **Stores** in `sms_transactions` table (status: pending)
9. **Inserts** into `notifications` table (is_read: false)
10. **Pushes** via Supabase Realtime broadcast
11. **Web app** polls notifications every 5s OR receives realtime event
12. **SmsApprovalModal** pops up showing:
    - Amount: ₹500
    - Paid to: Rahul Kumar
    - Bank: UPI Payment
    - UPI Ref: 123456789012
13. **User selects:**
    - Category: Food / Groceries / Transport / etc.
    - Payment Method: Personal / Joint Account / Credit Card
14. **User clicks "Add Expense"**:
    - Creates expense in `expenses` table
    - Updates `sms_transactions` status to 'approved'
    - Links `expense_id` to SMS record
    - Marks notification as read
    - Shows success toast
15. **OR user clicks "Ignore"**:
    - Updates `sms_transactions` status to 'rejected'
    - Marks notification as read
    - Shows info toast

## 🎨 UI Components

### SmsApprovalModal
- **Triggered:** Automatically when SMS detected
- **Shows:**
  - Animated bell icon with "Live" badge
  - Large amount display (red, bold)
  - Payee, Bank, UPI Ref, Timestamp
  - Category dropdown with emoji icons
  - Payment method dropdown
  - "Ignore" (gray) and "Add Expense" (gradient blue-purple) buttons
- **Actions:**
  - Approve: Creates expense, marks as read
  - Ignore: Marks as rejected, dismisses

### QuickExpenseAdd (Fallback)
- **Triggered:** Manual floating button (bottom-left)
- **Shows:** Simple form with amount, payee, category, payment method
- **Use case:** When SMS detection isn't available

## 🔐 Security

- **Row Level Security (RLS):** Users can only access their own data
- **Service Role:** Edge function uses service role key (server-side only)
- **User Token:** Mobile app sends user_id (validated against auth)
- **CORS:** Proper CORS headers for cross-origin requests
- **Permission Scoping:** Android permissions requested at runtime

## 📊 Database Schema

### sms_transactions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| raw_text | TEXT | Original SMS text |
| amount | DECIMAL(12,2) | Parsed amount |
| payee | TEXT | Payee name |
| bank | TEXT | Bank name |
| upi_ref | TEXT | UPI reference |
| confidence | TEXT | high/medium/low |
| status | TEXT | pending/approved/rejected/ignored |
| category | TEXT | Selected category |
| payment_method | TEXT | Selected payment method |
| expense_id | UUID | Linked expense |
| device_id | TEXT | Mobile device ID |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

### notifications
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| type | TEXT | sms_expense |
| title | TEXT | Notification title |
| message | TEXT | Notification message |
| data | JSONB | Transaction data |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMPTZ | Created timestamp |

## 🧪 Testing

### Test the Edge Function
```bash
curl -X POST https://ntcvlnurhsncllwnxtus.supabase.co/functions/v1/api-sms-receive \
  -H "Content-Type: application/json" \
  -d '{
    "text": "₹500 paid to Rahul Kumar (rahul@upi). UPI: 123456789012",
    "user_id": "your-user-id"
  }'
```

### Test SMS Detection
Send a test SMS to your phone:
```
HDFC Bank: Rs.500.00 debited from a/c XX1234 to SWIGGY on 2024-01-15. UPI: 123456789012. Avl Bal: Rs.10000.00
```

The mobile app should detect it and forward to backend.

## 📝 Supported SMS Formats

### HDFC Bank
```
HDFC Bank: Rs.500.00 debited from a/c XX1234 to SWIGGY. UPI: 123456789012
```

### SBI
```
SBI: Rs.1,200 debited to AMAZON. Ref: TXN123456
```

### ICICI
```
ICICI Bank: INR 750.00 paid to FLIPKART on 15-Jan-2024
```

### UPI (Google Pay / PhonePe / Paytm)
```
₹500 paid to Rahul Kumar (rahul@okaxis). UPI: 123456789012
Payment of ₹1,200 to Swiggy successful
Rs.350 debited from a/c XX5678 to Zomato
```

### Generic Bank
```
Rs.500 debited to Merchant Name. Available balance: Rs.10000
```

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** PostgreSQL (Supabase)
- **Realtime:** Supabase Realtime (broadcast + polling)
- **Mobile:** React Native + Android Native Modules
- **SMS Detection:** Android BroadcastReceiver + SMS permissions

## 📱 Mobile App Features

- **Background SMS listening** (Android)
- **Permission handling** (Android 13+ compatible)
- **Bank SMS filtering** (keyword + amount detection)
- **Deduplication** (60s window)
- **Local notifications** when expense detected
- **Transaction history** (last 20)
- **Retry failed** transactions
- **Device ID** persistence
- **User ID** management

## 🎯 Next Steps

1. **Deploy** the Edge Function to Supabase
2. **Run** the SQL schema in Supabase
3. **Build** the React Native mobile app
4. **Test** with real bank SMS
5. **Customize** regex patterns for your bank
6. **Add** more banks to the parser
7. **Implement** iOS version (requires different approach due to iOS restrictions)

## ⚠️ Notes

- **iOS Limitation:** iOS doesn't allow background SMS reading. Use manual entry or share extension.
- **Android Permissions:** READ_SMS permission is sensitive. Google Play may require justification.
- **Battery Optimization:** Ask users to disable battery optimization for the app to ensure background SMS listening works.
- **Privacy:** SMS data is sent to your backend. Ensure compliance with privacy regulations.

## 📄 License

MIT

## 👨‍💻 Author

Built with ❤️ by [Your Name]

---

**Ready to deploy!** All code is production-ready and fully typed with TypeScript.