// ============================================================
// WebAuthn helper — Face ID / Touch ID / Fingerprint
// Works on iOS Safari 16+, Android Chrome, macOS Safari
// ============================================================

const RP_NAME = 'FamilyFinance';
const RP_ID = window.location.hostname;

// Convert base64url string to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate a random challenge as plain ArrayBuffer (no SharedArrayBuffer)
function generateChallenge(): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  crypto.getRandomValues(new Uint8Array(buf));
  return buf;
}

// Check if WebAuthn is supported
export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function'
  );
}

// Check if platform authenticator (Face ID / Touch ID) is available
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ── REGISTER ────────────────────────────────────────────────
export interface RegisterBiometricOptions {
  userId: string;
  userEmail: string;
  displayName: string;
}

export interface BiometricCredential {
  credentialId: string;
  publicKey: string;
}

export async function registerBiometric(
  opts: RegisterBiometricOptions
): Promise<BiometricCredential> {
  const challenge = generateChallenge();

  // Encode userId into a plain ArrayBuffer (max 64 bytes)
  const userIdEncoded = new TextEncoder().encode(opts.userId.slice(0, 64));
  const userIdBuf = new ArrayBuffer(userIdEncoded.length);
  new Uint8Array(userIdBuf).set(userIdEncoded);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,                          // already plain ArrayBuffer
      rp: { name: RP_NAME, id: RP_ID },
      user: {
        id: userIdBuf,                    // plain ArrayBuffer ✓
        name: opts.userEmail,
        displayName: opts.displayName,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256 (Windows Hello)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric registration cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialId = arrayBufferToBase64url(credential.rawId);
  const pkBuf = response.getPublicKey();
  const publicKey = pkBuf ? arrayBufferToBase64url(pkBuf) : '';

  return { credentialId, publicKey };
}

// ── AUTHENTICATE ────────────────────────────────────────────
export interface AuthenticateOptions {
  credentialId: string;
}

export async function authenticateWithBiometric(
  opts: AuthenticateOptions
): Promise<boolean> {
  const challenge = generateChallenge();

  // Decode stored credential ID into plain ArrayBuffer
  const credIdBytes = base64urlToUint8Array(opts.credentialId);
  const credIdBuf = new ArrayBuffer(credIdBytes.length);
  new Uint8Array(credIdBuf).set(credIdBytes);

  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,                        // plain ArrayBuffer ✓
        rpId: RP_ID,
        allowCredentials: [
          {
            id: credIdBuf,               // plain ArrayBuffer ✓
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    return !!credential;
  } catch (err) {
    console.error('Biometric auth error:', err);
    return false;
  }
}

// ── SESSION CACHE ────────────────────────────────────────────
const SESSION_KEY = 'ff_biometric_session';
const SESSION_HOURS = 8;

export function setBiometricSession(): void {
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  localStorage.setItem(SESSION_KEY, String(expiry));
}

export function hasBiometricSession(): boolean {
  const expiry = localStorage.getItem(SESSION_KEY);
  if (!expiry) return false;
  return Date.now() < Number(expiry);
}

export function clearBiometricSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
