// ============================================================
// SMS Receive Edge Function
// POST /api/v1/sms/receive
// Accepts raw SMS text from mobile companion app, parses it
// using regex, and pushes real-time notification to the web app
// via Supabase Realtime.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

interface SmsPayload {
  text: string;
  user_id: string;
  device_id?: string;
  received_at?: string;
}

interface ParsedTransaction {
  amount: number;
  payee: string;
  bank: string;
  upi_ref?: string;
  raw: string;
  confidence: 'high' | 'medium' | 'low';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// BANK SMS REGEX PATTERNS (Indian banks)
// ============================================================

interface BankPattern {
  name: string;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray) => { amount: number; payee: string; };
}

const BANK_PATTERNS: BankPattern[] = [
  // HDFC Bank
  {
    name: 'HDFC Bank',
    patterns: [
      /(?:HDFC|HDFC Bank)[:\s]*.*?(?:debited|paid|spent|txn)[:\s]*INR\s*([\d,]+\.?\d*)/i,
      /(?:txn|transaction|debited)\s*(?:of|for|by)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:at|to|for|via)\s*([A-Za-z0-9\s.&]+?)(?:\s*(?:on|ref|upi|avail|bal))/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: (m[2] || 'Unknown').trim(),
    }),
  },

  // SBI (State Bank of India)
  {
    name: 'SBI',
    patterns: [
      /(?:SBI|State Bank)[:\s]*.*?(?:debited|paid|withdrawn)[:\s]*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i,
      /(?:Acct|Account|a\/c)\s*(?:debited|credited)\s*(?:by|for)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:at|to|for|via)\s*([A-Za-z0-9\s.&]+?)(?:\s*(?:on|ref|upi|bal))/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: (m[2] || 'Unknown').trim(),
    }),
  },

  // ICICI Bank
  {
    name: 'ICICI Bank',
    patterns: [
      /(?:ICICI|ICICI Bank)[:\s]*.*?(?:debited|paid|txn)[:\s]*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i,
      /(?:debited|paid)\s*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:from|to|at)\s*([A-Za-z0-9\s.&]+?)(?:\s*(?:on|ref|upi|bal|avail))/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: (m[2] || 'Unknown').trim(),
    }),
  },

  // Axis Bank
  {
    name: 'Axis Bank',
    patterns: [
      /(?:Axis|Axis Bank)[:\s]*.*?(?:debited|paid|txn)[:\s]*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i,
      /(?:debited|paid)\s*(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:at|to|for|via)\s*([A-Za-z0-9\s.&]+?)(?:\s*(?:on|ref|upi))/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: (m[2] || 'Unknown').trim(),
    }),
  },

  // Generic UPI / GPay / PhonePe / Paytm
  {
    name: 'UPI Payment',
    patterns: [
      // ₹500 paid to X
      /[₹]\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited|transferred|payment of)\s*(?:to|for|from|via|at)\s*([A-Za-z0-9\s.&-]+?)(?:\s*(?:UPI|Ref|ref|txn|on|at|via|using))/i,
      // Payment of ₹500 to X successful
      /(?:Payment|payment|Txn|txn|paid)\s*(?:of|for)?\s*[₹]\s*([\d,]+(?:\.\d{1,2})?)\s*(?:to|for|made to|at)\s*([A-Za-z0-9\s.&-]+?)(?:\s*(?:successful|completed|UPI|Ref|ref))/i,
      // Rs.500 debited from a/c to X
      /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:debited|paid|transferred|sent)\s*(?:from|to)?\s*(?:a\/c|account|your)?\s*(?:XX?\d+)?\s*(?:to|for|at|via)\s*([A-Za-z0-9\s.&-]+?)(?:\s*(?:on|UPI|Ref|ref|txn))/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: (m[2] || 'Unknown').trim().replace(/\s*(?:successful|completed|done)\s*$/i, ''),
    }),
  },

  // Generic Bank SMS (catch-all)
  {
    name: 'Bank Transaction',
    patterns: [
      /(?:debited|paid|spent|withdrawn|payment)\s*(?:of|for|by|Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i,
      /(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s*(?:debited|paid|spent|withdrawn|payment)/i,
    ],
    extract: (m: RegExpMatchArray) => ({
      amount: parseFloat(m[1].replace(/,/g, '')),
      payee: 'Unknown',
    }),
  },
];

// ============================================================
// PARSER ENGINE
// ============================================================

function parseSms(text: string): ParsedTransaction | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 15) return null;

  // Must contain payment keywords
  const hasPaymentKeyword = /(?:paid|debited|sent|transferred|payment|withdrawn|spent|txn|transaction)/i.test(trimmed);
  if (!hasPaymentKeyword) return null;

  // Must contain a monetary amount
  const hasAmount = /(?:Rs\.?|INR|₹)\s*[\d,]/.test(trimmed) || /[\d,]+\.?\d*\s*(?:rupees?|rs)/i.test(trimmed);
  if (!hasAmount) return null;

  // Try each bank pattern
  for (const bank of BANK_PATTERNS) {
    for (const pattern of bank.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const { amount, payee } = bank.extract(match);
        if (amount > 0 && amount < 99999999) {
          // Extract UPI reference if present
          const refMatch = trimmed.match(/(?:UPI|Ref|ref|txn|Txn)[:\s]*([\dA-Za-z]{6,20})/);
          return {
            amount,
            payee: payee || 'Unknown',
            bank: bank.name,
            upi_ref: refMatch?.[1],
            raw: trimmed.slice(0, 500),
            confidence: bank.name === 'Bank Transaction' ? 'low' : 'high',
          };
        }
      }
    }
  }

  // Last resort — extract any amount
  const fallbackAmount = trimmed.match(/[₹₹]\s*([\d,]+(?:\.\d{1,2})?)/);
  if (fallbackAmount) {
    const amt = parseFloat(fallbackAmount[1].replace(/,/g, ''));
    if (amt > 0 && amt < 99999999) {
      return {
        amount: amt,
        payee: 'Unknown',
        bank: 'Unknown Bank',
        raw: trimmed.slice(0, 500),
        confidence: 'low',
      };
    }
  }

  return null;
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body
    const body: SmsPayload = await req.json();
    const { text, user_id } = body;

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse SMS
    const parsed = parseSms(text);

    if (!parsed) {
      // Still log the raw SMS for debugging but return error
      return new Response(
        JSON.stringify({
          error: 'Could not parse transaction from SMS text',
          raw: text.slice(0, 500),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    // Log the parsed transaction to the database
    const { data: smsLog, error: logError } = await supabase
      .from('sms_transactions')
      .insert({
        user_id,
        raw_text: text.slice(0, 1000),
        amount: parsed.amount,
        payee: parsed.payee,
        bank: parsed.bank,
        upi_ref: parsed.upi_ref,
        confidence: parsed.confidence,
        status: 'pending',
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log SMS:', logError);
      // Continue anyway — we still push the notification
    }

    const transactionId = smsLog?.id ?? crypto.randomUUID();

    // Push real-time notification via Supabase Realtime channel
    const channel = supabase.channel(`sms-transaction-${user_id}`);

    await channel.send({
      type: 'broadcast',
      event: 'new_transaction',
      payload: {
        id: transactionId,
        amount: parsed.amount,
        payee: parsed.payee,
        bank: parsed.bank,
        upi_ref: parsed.upi_ref,
        confidence: parsed.confidence,
        raw: parsed.raw,
        timestamp: new Date().toISOString(),
      },
    });

    // Also insert into a notifications table so the web app can poll
    if (smsLog?.id) {
      await supabase
        .from('notifications')
        .insert({
          user_id,
          type: 'sms_expense',
          title: `Expense of ₹${parsed.amount.toLocaleString('en-IN')} detected`,
          message: `Paid to ${parsed.payee} via ${parsed.bank}`,
          data: {
            transaction_id: smsLog.id,
            amount: parsed.amount,
            payee: parsed.payee,
            bank: parsed.bank,
            upi_ref: parsed.upi_ref,
          },
          is_read: false,
        })
        .select();
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transactionId,
          amount: parsed.amount,
          payee: parsed.payee,
          bank: parsed.bank,
          upi_ref: parsed.upi_ref,
          confidence: parsed.confidence,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    console.error('sms-receive error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${String(err)}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});