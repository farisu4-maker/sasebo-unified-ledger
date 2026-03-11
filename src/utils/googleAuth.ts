const b64url = (str: string) => btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const b64urlbuffer = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return b64url(str);
};

export async function getGoogleAuthToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  // 1. JWT Header
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = b64url(JSON.stringify(header));

  // 2. JWT Claim
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const encodedClaim = b64url(JSON.stringify(claim));

  const dataToSign = `${encodedHeader}.${encodedClaim}`;
  const dataBuffer = new TextEncoder().encode(dataToSign);

  // 3. Import PEM Key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  if (!privateKeyPem.includes(pemHeader)) {
    throw new Error('Invalid private key format');
  }

  // Format the key to a clean Base64 string for WebCrypto API
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\\n/g, '') // Handle escaped newlines from .env
    .replace(/\s/g, ''); // Remove all whitespace including actual newlines

  const binaryDerString = window.atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['sign']
  );

  // 4. Sign JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    dataBuffer
  );

  const encodedSignature = b64urlbuffer(signature);
  const jwt = `${dataToSign}.${encodedSignature}`;

  // 5. Exchange JWT for Google API Access Token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(body.error_description || body.error || 'Failed to get token');
  }

  return body.access_token;
}

let cachedToken: string | null = null;
let tokenExp: number = 0;

export async function getValidToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExp) {
    return cachedToken;
  }
  
  const email = import.meta.env.VITE_GOOGLE_CLIENT_EMAIL;
  // Retrieve private key. Support both literal \n and real newlines
  const rawKey = import.meta.env.VITE_GOOGLE_PRIVATE_KEY;
  
  if (!email || !rawKey) {
    throw new Error("Missing Google Service Account credentials in environment variables (.env.local)");
  }
  
  const token = await getGoogleAuthToken(email, rawKey);
  cachedToken = token;
  tokenExp = now + 3500 * 1000; // Cache for 58 minutes (expires in 60m)
  return token;
}
