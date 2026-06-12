// Supabase Edge Function — Gemini AI proxy
// Fixes: correct Gemini 1.5 Flash endpoint + error logging

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret not set. Go to Edge Functions → ai-assistant → Secrets and add it.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const body = await req.json();
    const { system, messages } = body as {
      system: string;
      messages: { role: string; content: string }[];
    };

    // Build Gemini contents — alternate user/model, must start with user
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Ensure first message is from user (Gemini requirement)
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    const payload = {
      system_instruction: {
        parts: [{ text: system ?? '' }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    // ✅ Correct Gemini 2.0 Flash endpoint (free tier)
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log('Calling Gemini URL:', geminiUrl.replace(GEMINI_API_KEY, 'KEY_HIDDEN'));
    console.log('Contents count:', contents.length);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const geminiData = await geminiRes.json();

    console.log('Gemini status:', geminiRes.status);
    console.log('Gemini response keys:', Object.keys(geminiData));

    if (!geminiRes.ok) {
      const errMsg = geminiData?.error?.message ?? JSON.stringify(geminiData);
      console.error('Gemini error:', errMsg);
      return new Response(
        JSON.stringify({ error: `Gemini API error (${geminiRes.status}): ${errMsg}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Extract text from Gemini response
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ??
      geminiData?.candidates?.[0]?.output ??
      '';

    if (!text) {
      console.error('No text in Gemini response:', JSON.stringify(geminiData));
      return new Response(
        JSON.stringify({ error: 'Gemini returned empty response', raw: geminiData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Return in the shape our frontend expects
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text }] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: `Edge function exception: ${String(err)}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
