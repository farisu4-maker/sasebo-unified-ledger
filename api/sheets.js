import crypto from 'crypto';

// サーバー側だけに保持する秘密情報（VITE_ プレフィックスを付けないことで
// クライアント向けビルドに絶対に含まれないようにする）
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const dataToSign = `${encodedHeader}.${encodedClaim}`;

  // Vercelの環境変数に改行そのまま貼れない場合に備えて \n エスケープにも対応
  const privateKey = PRIVATE_KEY.replace(/\\n/g, '\n');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(dataToSign);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSignature = signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${dataToSign}.${encodedSignature}`;

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

// このプロキシが中継してよいGoogle Sheets APIのパスだけを許可する
// （任意のGoogle APIへの踏み台になることを防ぐ）
function isAllowedPath(path) {
  return /^values\/[^/]+$/.test(path) || path === 'values:batchUpdate' || path === 'values:batchClear';
}

export default async function handler(req, res) {
  try {
    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      res.status(500).json({ error: 'Server is not configured (missing GOOGLE_* environment variables)' });
      return;
    }

    const path = req.query.path;
    if (!path || Array.isArray(path) || !isAllowedPath(path)) {
      res.status(400).json({ error: 'Invalid or disallowed path' });
      return;
    }

    const token = await getAccessToken();
    const targetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/${path}`;

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : JSON.stringify(req.body)
    });

    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}
