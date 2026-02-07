import { Octokit } from '@octokit/rest';
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
  
  // Update remaining secrets with retry
  const secrets = [
    ['DRIVER_KEY_ALIAS', '39ba8cae3cb029928f462a789af1e9a6'],
    ['DRIVER_KEY_PASSWORD', '4f41758b1ff68127362743950f88fbeb'],
    ['RIDER_KEYSTORE_PASSWORD', 'c557b067f453c9ed618da90628cc8b8e'],
    ['RIDER_KEY_ALIAS', 'ae532e061557629a346ce28693772f8c'],
    ['RIDER_KEY_PASSWORD', 'd7df4a48a3339acf55fbf77a44d4e4a7'],
  ];
  
  for (const [name, value] of secrets) {
    try {
      await updateSecret(octokit, owner, repo, name, value);
    } catch (e: any) {
      console.log(`Retry ${name}...`);
      await new Promise(r => setTimeout(r, 2000));
      await updateSecret(octokit, owner, repo, name, value);
    }
  }
  
  console.log('\nTriggering build...');
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: 'build-android.yml', ref: 'main',
    inputs: { app_variant: 'both', publish_track: 'none' }
  });
  console.log('Build triggered! Check: https://github.com/HorseChain/travony/actions');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
