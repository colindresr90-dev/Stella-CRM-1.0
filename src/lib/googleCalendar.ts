import { google } from 'googleapis';

export async function getGoogleAuthClient() {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is missing.');
  }

  // Clean the key: remove quotes and handle escaped newlines
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.substring(1, key.length - 1);
  }
  const formattedKey = key.replace(/\\n/g, '\n').replace(/\n/g, '\n').trim();

  // NUCLEAR DEBUG: Confirming key content structure
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error(`Auth Error: Key header missing. Starts with: ${formattedKey.substring(0, 15)}... (Length: ${formattedKey.length})`);
  }

  // Use GoogleAuth with explicit credentials object - very robust
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: formattedKey,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const client = await auth.getClient();
    // Verify the client has the key set
    if (!(client as any).key && !(client as any)._key) {
       console.log('Warning: Client key might be missing');
    }
    return client;
  } catch (err: any) {
    throw new Error(`GoogleAuth Client Creation Failed: ${err.message}`);
  }
}

export async function getGoogleCalendarClient() {
  const auth = await getGoogleAuthClient();
  return google.calendar({ version: 'v3', auth: auth as any });
}
