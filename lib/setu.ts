import jwt from 'jsonwebtoken';

// ─── Config ───────────────────────────────────────────────────────────────────

interface SetuConfig {
  clientId: string;
  clientSecret: string;
  schemeId: string;
  webhookSecret: string;
  baseUrl: string;
}

function getConfig(): SetuConfig {
  const clientId = process.env.SETU_CLIENT_ID;
  const clientSecret = process.env.SETU_CLIENT_SECRET;
  const schemeId = process.env.SETU_SCHEME_ID;
  const webhookSecret = process.env.SETU_WEBHOOK_SECRET;
  const mode = process.env.SETU_MODE ?? 'sandbox';

  if (!clientId) throw new Error('SETU_CLIENT_ID is not set');
  if (!clientSecret) throw new Error('SETU_CLIENT_SECRET is not set');
  if (!schemeId) throw new Error('SETU_SCHEME_ID is not set');
  if (!webhookSecret) throw new Error('SETU_WEBHOOK_SECRET is not set');

  const baseUrl =
    mode === 'production' ? 'https://prod.setu.co' : 'https://uat.setu.co';

  return { clientId, clientSecret, schemeId, webhookSecret, baseUrl };
}

// ─── Token cache ──────────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // Unix epoch ms
}

let tokenCache: TokenCache | null = null;

/**
 * Returns a valid Setu Bearer token, refreshing it when within 2 minutes of
 * expiry. Tokens are valid for 30 minutes.
 */
async function getSetuToken(): Promise<string> {
  const { clientId, clientSecret, baseUrl } = getConfig();

  const TWO_MINUTES_MS = 2 * 60 * 1000;
  if (tokenCache && Date.now() < tokenCache.expiresAt - TWO_MINUTES_MS) {
    return tokenCache.token;
  }

  const res = await fetch(`${baseUrl}/auth/detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientID: clientId, secret: clientSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Setu auth failed (${res.status}): ${text}`);
  }

  // Setu returns: { status: 200, success: true, token: { jwt: "..." } }
  const data = (await res.json()) as { token: { jwt: string } };
  const token = data.token.jwt;

  tokenCache = {
    token,
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 min validity
  };

  return token;
}

// ─── Payment link creation ────────────────────────────────────────────────────

export interface SetuPaymentLinkResult {
  setuPaymentId: string;
  upiLink: string;
  qrCode: string;
  shortUrl: string;
  expiresAt: string; // ISO 8601
}

/**
 * Creates a Setu UPI payment link for wallet recharge.
 *
 * @param userId          Internal user ID — stored in additionalInfo for reconciliation
 * @param amountInPaise   Amount in paise (e.g. 50000 = ₹500)
 * @param expiresInMinutes  Link TTL; defaults to 30 minutes
 */
export async function createPaymentLink(
  userId: string,
  amountInPaise: number,
  expiresInMinutes = 30
): Promise<SetuPaymentLinkResult> {
  const { baseUrl, schemeId } = getConfig();
  const token = await getSetuToken();

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const res = await fetch(`${baseUrl}/api/pg/v1/payment_links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Setu-Product-Instance-ID': schemeId,
    },
    body: JSON.stringify({
      amount: {
        value: amountInPaise,
        currencyCode: 'INR',
      },
      description: 'Wallet Recharge',
      expiryDate: expiresAt.toISOString(),
      settlementDetails: {
        settlementType: 'LINK',
      },
      additionalInfo: {
        userId,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Setu createPaymentLink failed (${res.status}): ${text}`);
  }

  // Setu Collect response shape:
  // { platformBillID, paymentLink: { upiLink, shortURL, upiID, expiryDate } }
  const data = (await res.json()) as {
    platformBillID: string;
    paymentLink: {
      upiLink: string;
      shortURL: string;
      upiID: string;   // UPI ID usable for QR generation
      expiryDate: string;
    };
  };

  return {
    setuPaymentId: data.platformBillID,
    upiLink: data.paymentLink.upiLink,
    qrCode: data.paymentLink.upiID,
    shortUrl: data.paymentLink.shortURL,
    expiresAt: data.paymentLink.expiryDate,
  };
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verifies the x-setu-signature header on incoming webhooks.
 * Setu signs its webhook payload as an HS256 JWT using the client secret.
 * Returns true if valid, false otherwise (never throws).
 */
export function verifyWebhookSignature(
  _rawBody: string,
  setuSignature: string
): boolean {
  const { webhookSecret } = getConfig();
  try {
    jwt.verify(setuSignature, webhookSecret, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}
