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
  
  console.log('=== FIXING: Both apps use the SAME keystore (D9:2D:...) ===\n');
  
  // The keystore with fingerprint D9:2D:... is rider-keystore.jks
  const correctKeystoreB64 = fs.readFileSync('credentials/rider-keystore.jks.b64', 'utf-8').replace(/\n/g, '');
  
  // Both apps need this keystore
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_BASE64', correctKeystoreB64);
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_BASE64', correctKeystoreB64);
  
  // Both apps need the same password and alias (from rider keystore)
  const password = 'c0e830b36d0813d13abd3c2e3eebb203';
  const alias = '39ba8cae3cb029928f462a789af1e9a6';
  const keyPassword = '4f41758b1ff68127362743950f88fbeb';
  
  await updateSecret(octokit, owner, repo, 'RIDER_KEYSTORE_PASSWORD', password);
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_ALIAS', alias);
  await updateSecret(octokit, owner, repo, 'RIDER_KEY_PASSWORD', keyPassword);
  
  // Driver already has these set correctly, but let's ensure consistency
  await updateSecret(octokit, owner, repo, 'DRIVER_KEYSTORE_PASSWORD', password);
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_ALIAS', alias);
  await updateSecret(octokit, owner, repo, 'DRIVER_KEY_PASSWORD', keyPassword);

  console.log('\n=== Cancelling current build and triggering new one ===');
  
  // Cancel current running build
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', status: 'in_progress'
  });
  
  for (const run of runs.workflow_runs) {
    console.log(`Cancelling run #${run.run_number}...`);
    await octokit.actions.cancelWorkflowRun({ owner, repo, run_id: run.id });
  }
  
  // Wait a moment for cancellation
  await new Promise(r => setTimeout(r, 3000));
  
  // Trigger new build
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: 'build-android.yml', ref: 'main',
    inputs: { app_variant: 'both', publish_track: 'none' }
  });
  
  console.log('\nNew build triggered! Both apps will now use keystore with fingerprint:');
  console.log('  SHA1: D9:2D:F9:4D:42:45:9D:BC:A0:AF:79:42:21:F7:0C:2E:91:B5:BA:D9');
  console.log('\nCheck: https://github.com/HorseChain/travony/actions');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
