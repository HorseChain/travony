import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import sodium from 'libsodium-wrappers';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) throw new Error('GitHub not connected');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  await sodium.ready;
  const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binsec = sodium.from_string(secretValue);
  const encBytes = sodium.crypto_box_seal(binsec, binkey);
  return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
}

async function updateSecret(octokit: Octokit, owner: string, repo: string, secretName: string, secretValue: string) {
  const { data: publicKey } = await octokit.actions.getRepoPublicKey({ owner, repo });
  const encryptedValue = await encryptSecret(publicKey.key, secretValue);
  await octokit.actions.createOrUpdateRepoSecret({
    owner, repo, secret_name: secretName, encrypted_value: encryptedValue, key_id: publicKey.key_id,
  });
  console.log(`Updated secret: ${secretName}`);
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: repos } = await octokit.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 10 });
  const travonyRepo = repos.find(r => r.name.toLowerCase().includes('travony'));
  if (!travonyRepo) throw new Error('Could not find Travony repository');
  const [owner, repo] = travonyRepo.full_name.split('/');
  console.log(`Repository: ${travonyRepo.full_name}`);

  // Based on Google Play fingerprint expectations:
  // - T Driver expects fingerprint D9:2D:... which is in rider-keystore.jks
  // - T Ride expects fingerprint 57:4F:... which is in driver-keystore.jks
  // The keystores are named confusingly - need to swap them for the builds
  
  const riderKeystoreB64 = fs.readFileSync('credentials/rider-keystore.jks.b64', 'utf-8').replace(/\n/g, '');
  const driverKeystoreB64 = fs.readFileSync('credentials/driver-keystore.jks.b64', 'utf-8').replace(/\n/g, '');

  console.log('\nUpdating GitHub secrets with SWAPPED keystores...');
  console.log('- DRIVER_KEYSTORE_BASE64 will use rider-keystore.jks (fingerprint D9:2D:...)');
  console.log('- RIDER_KEYSTORE_BASE64 will use driver-keystore.jks (fingerprint 57:4F:...)');
  
  // SWAP: Use rider keystore for driver app, driver keystore for rider app
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_BASE64', riderKeystoreB64);
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_BASE64', driverKeystoreB64);
  
  // Also need to swap the passwords and aliases
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_PASSWORD', 'c0e830b36d0813d13abd3c2e3eebb203');
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_ALIAS', '39ba8cae3cb029928f462a789af1e9a6');
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_PASSWORD', '4f41758b1ff68127362743950f88fbeb');
  
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_PASSWORD', 'c557b067f453c9ed618da90628cc8b8e');
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_ALIAS', 'ae532e061557629a346ce28693772f8c');
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_PASSWORD', 'd7df4a48a3339acf55fbf77a44d4e4a7');

  console.log('\nAll secrets updated! Triggering new build...');
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: 'build-android.yml', ref: 'main',
    inputs: { app_variant: 'both', publish_track: 'none' }
  });
  
  console.log(`Build triggered! Check: https://github.com/${owner}/${repo}/actions`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
