// Google Drive OAuth bridge for AI Studio Starter/Free Cloud Run.
// The existing server asks the Cloud Run metadata endpoint for a token.
// When OAuth refresh-token credentials are configured, translate that request
// into a normal Google OAuth refresh-token exchange. This avoids Cloud Run IAM.
//
// Required runtime variables:
// GOOGLE_DRIVE_OAUTH_CLIENT_ID
// GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
// GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN

const originalFetch = globalThis.fetch.bind(globalThis);

async function getOAuthAccessToken() {
  const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN || '').trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth belum lengkap: GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, dan GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN wajib diisi.');
  }

  const response = await originalFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('Google OAuth refresh gagal (' + response.status + '): ' + String(payload.error_description || payload.error || 'unknown_error'));
  }

  const accessToken = String(payload.access_token || '').trim();
  if (!accessToken) throw new Error('Google OAuth refresh tidak mengembalikan access token.');

  return new Response(JSON.stringify({ access_token: accessToken, token_type: 'Bearer', expires_in: Number(payload.expires_in || 3600) }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

globalThis.fetch = async function patchedFetch(input, init) {
  const url = typeof input === 'string' ? input : String(input?.url || input || '');
  if (url.startsWith('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token') &&
      String(process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN || '').trim()) {
    return getOAuthAccessToken();
  }
  return originalFetch(input, init);
};

require('./dist/server.cjs');
