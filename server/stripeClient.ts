import Stripe from 'stripe';

let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

function getEnvCredentials(): { publishableKey: string; secretKey: string } | null {
  const secretKey = process.env.SK_LIVE || process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.PK_LIVE || process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (secretKey && publishableKey) {
    // Validate key format
    if (!secretKey.startsWith('sk_live') && !secretKey.startsWith('sk_test')) {
      console.error('Stripe: Invalid secret key format. Must start with sk_live or sk_test');
      return null;
    }
    if (!publishableKey.startsWith('pk_live') && !publishableKey.startsWith('pk_test')) {
      console.error('Stripe: Invalid publishable key format. Must start with pk_live or pk_test');
      return null;
    }
    
    const isLive = secretKey.startsWith('sk_live');
    console.log(`Stripe: Using ${isLive ? 'LIVE' : 'TEST'} keys from environment`);
    return { publishableKey, secretKey };
  }
  
  // If only one is set, log which one is missing
  if (secretKey && !publishableKey) {
    console.warn('Stripe: SK_LIVE is set but PK_LIVE is missing');
  }
  if (publishableKey && !secretKey) {
    console.warn('Stripe: PK_LIVE is set but SK_LIVE is missing');
  }
  
  return null;
}

async function getCredentials() {
  // Return cached credentials if available
  if (cachedCredentials) {
    return cachedCredentials;
  }
  
  // First try environment variables (preferred for LIVE mode)
  const envCreds = getEnvCredentials();
  if (envCreds) {
    cachedCredentials = envCreds;
    return envCreds;
  }

  // Fallback to Replit connector (for development/test mode)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Card payments are currently unavailable. Please try again later or contact support.');
  }

  try {
    const connectorName = 'stripe';
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const targetEnvironment = isProduction ? 'production' : 'development';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    if (!connectionSettings?.settings?.publishable || !connectionSettings?.settings?.secret) {
      throw new Error('Card payments are currently unavailable. Please try again later.');
    }

    // Validate connector keys
    const { publishable, secret } = connectionSettings.settings;
    if (!secret.startsWith('sk_') || !publishable.startsWith('pk_')) {
      console.error('Stripe connector returned invalid key format');
      throw new Error('Card payments are temporarily unavailable. Please try again later.');
    }

    cachedCredentials = {
      publishableKey: publishable,
      secretKey: secret,
    };
    
    console.log(`Stripe: Using ${secret.startsWith('sk_live') ? 'LIVE' : 'TEST'} keys from connector`);
    return cachedCredentials;
  } catch (error: any) {
    console.error('Stripe connector error:', error.message);
    throw new Error('Card payments are currently unavailable. Please try again later.');
  }
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}
