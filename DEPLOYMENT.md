# Deployment Checklist

## ✅ Pre-Deployment Verification

### Files to Deploy to GitHub:
- [x] `supabase/functions/api-sms-receive/index.ts` - Edge function
- [x] `supabase/sql/supabase-sms-schema.sql` - Database schema
- [x] `src/hooks/useSmsNotifications.ts` - Frontend hook
- [x] `src/components/ui/SmsApprovalModal.tsx` - Approval modal
- [x] `src/components/layout/Layout.tsx` - Layout integration
- [x] `src/components/ui/QuickExpenseAdd.tsx` - Quick add fallback
- [x] `mobile/App.tsx` - React Native app
- [x] `mobile/android/` - Android native modules
- [x] `README.md` - Documentation

### Files Removed (Cleanup):
- [x] `src/hooks/useSpeech.ts` - Deleted
- [x] `src/components/ui/SpeechButton.tsx` - Deleted
- [x] `src/components/ui/ReadAloudControls.tsx` - Deleted
- [x] `src/hooks/useUpiDetector.ts` - Deleted
- [x] `src/components/ui/UpiDetectionPopup.tsx` - Deleted
- [x] `src/utils/upiParser.ts` - Deleted

### Configuration Verified:
- [x] Edge function name: `api-sms-receive`
- [x] Endpoint URL: `https://ntcvlnurhsncllwnxtus.supabase.co/functions/v1/api-sms-receive`
- [x] Mobile app configured with correct Supabase URL
- [x] No stale references to deleted files
- [x] All imports cleaned up
- [x] Unused imports removed (AlertCircle, Wallet)

## 🚀 Deployment Steps

### 1. Deploy Edge Function
```bash
supabase functions deploy api-sms-receive --file supabase/functions/api-sms-receive/index.ts
```

### 2. Run Database Schema
- Open Supabase Dashboard → SQL Editor
- Copy contents of `supabase/sql/supabase-sms-schema.sql`
- Execute to create tables

### 3. Verify Environment Variables
Edge function automatically has:
- `SUPABASE_URL` = `https://ntcvlnurhsncllwnxtus.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (auto-configured)

### 4. Test the Endpoint
```bash
curl -X POST https://ntcvlnurhsncllwnxtus.supabase.co/functions/v1/api-sms-receive \
  -H "Content-Type: application/json" \
  -d '{
    "text": "₹500 paid to Rahul Kumar (rahul@upi). UPI: 123456789012",
    "user_id": "test-user-id"
  }'
```

Expected response:
```json
{
  "success": true,
  "transaction": {
    "id": "...",
    "amount": 500,
    "payee": "Rahul Kumar",
    "bank": "UPI Payment",
    "upi_ref": "123456789012",
    "confidence": "high"
  }
}
```

### 5. Commit to GitHub
```bash
git add .
git commit -m "feat: Add automated SMS expense tracking system

- Backend: Supabase Edge Function (api-sms-receive) with regex parser
- Database: sms_transactions + notifications tables
- Frontend: useSmsNotifications hook + SmsApprovalModal
- Mobile: React Native app with Android SMS receiver
- Supports HDFC, SBI, ICICI, Axis, UPI formats
- Real-time notifications via Supabase Realtime
- Auto-detects bank SMS and prompts to add expense"

git push origin main
```

## ⚠️ Important Notes

1. **Mobile App**: Requires React Native setup separately (see README)
2. **Android Permissions**: READ_SMS is a sensitive permission
3. **iOS**: Not supported (iOS restrictions on SMS access)
4. **Testing**: Use real bank SMS for best results
5. **Customization**: Add more bank patterns in `BANK_PATTERNS` array

## ✨ Ready for Production

All code is:
- ✅ Fully typed with TypeScript
- ✅ Production-ready
- ✅ Properly configured for your Supabase project
- ✅ Cleaned up (no unused files/code)
- ✅ Documented with README