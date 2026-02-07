import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import sodium from 'libsodium-wrappers';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('GitHub not connected');
  const data = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json());
  return data.items?.[0]?.settings?.access_token || data.items?.[0]?.settings?.oauth?.credentials?.access_token;
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  await sodium.ready;
  const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binsec = sodium.from_string(secretValue);
  return sodium.to_base64(sodium.crypto_box_seal(binsec, binkey), sodium.base64_variants.ORIGINAL);
}

async function updateSecret(octokit: Octokit, owner: string, repo: string, secretName: string, secretValue: string) {
  const { data: publicKey } = await octokit.actions.getRepoPublicKey({ owner, repo });
  await octokit.actions.createOrUpdateRepoSecret({
    owner, repo, secret_name: secretName, 
    encrypted_value: await encryptSecret(publicKey.key, secretValue), 
    key_id: publicKey.key_id,
  });
  console.log(`Updated: ${secretName}`);
}

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const owner = 'HorseChain', repo = 'travony';
  
  console.log('=== FIXING: Each app uses its OWN keystore ===\n');
  console.log('T RIDE needs: D9:2D:... (rider-keystore.jks)');
  console.log('T DRIVER needs: 57:4F:... (driver-keystore.jks)\n');
  
  // rider-keystore.jks has fingerprint D9:2D:... -> for T RIDE
  const riderKeystoreB64 = fs.readFileSync('credentials/rider-keystore.jks.b64', 'utf-8').replace(/\n/g, '');
  
  // driver-keystore.jks has fingerprint 57:4F:... -> for T DRIVER
  const driverKeystoreB64 = fs.readFileSync('credentials/driver-keystore.jks.b64', 'utf-8').replace(/\n/g, '');
  
  // T RIDE uses rider keystore
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_BASE64', riderKeystoreB64);
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_PASSWORD', 'c0e830b36d0813d13abd3c2e3eebb203');
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_ALIAS', '39ba8cae3cb029928f462a789af1e9a6');
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_PASSWORD', '4f41758b1ff68127362743950f88fbeb');
  
  // T DRIVER uses driver keystore
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_BASE64', driverKeystoreB64);
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_PASSWORD', 'c557b067f453c9ed618da90628cc8b8e');
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_ALIAS', 'ae532e061557629a346ce28693772f8c');
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_PASSWORD', 'd7df4a48a3339acf55fbf77a44d4e4a7');

  console.log('\n=== Triggering new build ===');
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: 'build-android.yml', ref: 'main',
    inputs: { app_variant: 'both', publish_track: 'none' }
  });
  
  console.log('\nBuild triggered!');
  console.log('  T RIDE will be signed with: D9:2D:F9:4D:42:45:9D:BC:A0:AF:...');
  console.log('  T DRIVER will be signed with: 57:4F:A8:CC:41:3C:55:B8:0A:01:...');
  console.log('\nCheck: https://github.com/HorseChain/travony/actions');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
