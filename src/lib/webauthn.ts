// ============================================================
// WebAuthn helper — Face ID / Touch ID / Fingerprint
// Works on iOS Safari 16+, Android Chrome, macOS Safari
// ============================================================

const RP_NAME = 'FamilyFinance';
const RP_ID = window.location.hostname; // e.g. prasad.github.io

// Convert base64url string to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Convert ArrayBuffer / Uint8Array to base64url string
function uint8ArrayToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate a random challenge
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Check if WebAuthn / biometrics is supported on this device
export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
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
// Call this when user wants to set up biometric login
export interface RegisterBiometricOptions {
  userId: string;       // Supabase user UUID
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

  // Encode userId as bytes (must be max 64 bytes)
  const userIdBytes = new TextEncoder().encode(opts.userId.slice(0, 64));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME, id: RP_ID },
      user: {
        id: userIdBytes,
        name: opts.userEmail,
        displayName: opts.displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (most common)
        { alg: -257, type: 'public-key' }, // RS256 (Windows Hello)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // device built-in only (Face ID, Touch ID)
        userVerification: 'required',        // must verify with biometric
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  if (!credential) throw new Error('Biometric registration cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;

  // Store the credential ID and public key (we store raw for simplicity)
  const credentialId = uint8ArrayToBase64url(credential.rawId);
  const publicKey = uint8ArrayToBase64url(response.getPublicKey() || new ArrayBuffer(0));

  return { credentialId, publicKey };
}

// ── AUTHENTICATE ────────────────────────────────────────────
// Call this to authenticate with Face ID / fingerprint
export interface AuthenticateOptions {
  credentialId: string; // stored credential ID
}

export async function authenticateWithBiometric(
  opts: AuthenticateOptions
): Promise<boolean> {
  const challenge = generateChallenge();

  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: RP_ID,
        allowCredentials: [
          {
            id: base64urlToUint8Array(opts.credentialId),
            type: 'public-key',
            transports: ['internal'], // device authenticator
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential;

    // If we got a credential back, authentication succeeded
    return !!credential;
  } catch (err) {
    // NotAllowedError = user cancelled or timed out
    // SecurityError = wrong domain
    console.error('Biometric auth error:', err);
    return false;
  }
}

// ── SESSION CACHE ────────────────────────────────────────────
// After biometric success, cache a timestamp so user isn't
// asked again for a configurable period (default 8 hours)
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
