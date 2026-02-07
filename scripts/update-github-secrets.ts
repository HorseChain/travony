import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import sodium from 'libsodium-wrappers';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('GitHub not connected');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  await sodium.ready;
  const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binsec = sodium.from_string(secretValue);
  const encBytes = sodium.crypto_box_seal(binsec, binkey);
  return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
}

async function updateSecret(octokit: Octokit, owner: string, repo: string, secretName: string, secretValue: string) {
  const { data: publicKey } = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  });

  const encryptedValue = await encryptSecret(publicKey.key, secretValue);

  await octokit.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id,
  });

  console.log(`Updated secret: ${secretName}`);
}

async function main() {
  try {
    const accessToken = await getAccessToken();
    const octokit = new Octokit({ auth: accessToken });

    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 10
    });
    
    const travonyRepo = repos.find(r => r.name.toLowerCase().includes('travony') || r.name.toLowerCase().includes('t-ride'));
    
    if (!travonyRepo) {
      console.log('Available repos:', repos.map(r => r.full_name).join(', '));
      throw new Error('Could not find Travony repository');
    }

    const [owner, repo] = travonyRepo.full_name.split('/');
    console.log(`Found repository: ${travonyRepo.full_name}`);

    const riderKeystoreB64 = fs.readFileSync('credentials/rider-keystore.jks.b64', 'utf-8').replace(/\n/g, '');
    const driverKeystoreB64 = fs.readFileSync('credentials/driver-keystore.jks.b64', 'utf-8').replace(/\n/g, '');

    console.log('\nUpdating GitHub secrets...');
    
    await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_BASE64', riderKeystoreB64);
    await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_BASE64', driverKeystoreB64);

    console.log('\nSecrets updated successfully!');
    console.log('You can now re-run the GitHub Actions build workflow.');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
