const { Octokit } = require('@octokit/rest');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apps = {
  rider: { package: 'com.travony.rider', artifact: 't-ride-aab', file: 't-ride.aab' },
  driver: { package: 'com.travony.driver', artifact: 't-driver-aab', file: 't-driver.aab' }
};

async function getGitHubToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  const data = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json());
  return data.items?.[0]?.settings?.access_token || data.items?.[0]?.settings?.oauth?.credentials?.access_token;
}

async function downloadArtifact(octokit, artifactName) {
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner: 'HorseChain', repo: 'travony', workflow_id: 'build-android.yml', per_page: 1, status: 'completed'
  });
  
  const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
    owner: 'HorseChain', repo: 'travony', run_id: runs.workflow_runs[0].id
  });
  
  const artifact = artifacts.artifacts.find(a => a.name === artifactName);
  if (!artifact) throw new Error(`Artifact ${artifactName} not found`);
  
  const { data: download } = await octokit.actions.downloadArtifact({
    owner: 'HorseChain', repo: 'travony', artifact_id: artifact.id, archive_format: 'zip'
  });
  
  const zipPath = `/tmp/${artifactName}.zip`;
  fs.writeFileSync(zipPath, Buffer.from(download));
  
  execSync(`cd /tmp && unzip -o ${artifactName}.zip`, { stdio: 'pipe' });
  console.log(`✓ Downloaded ${artifactName}`);
  
  return `/tmp/${artifactName.replace('-aab', '')}.aab`;
}

async function uploadToPlayStore(packageName, aabPath, track = 'internal') {
  const credentials = JSON.parse(fs.readFileSync('attached_assets/replit-publisher-084dbaff4147_1769739843670.json', 'utf8'));
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  // Create edit
  const { data: edit } = await androidpublisher.edits.insert({ packageName });
  console.log(`  Created edit: ${edit.id}`);

  // Upload AAB
  const { data: bundle } = await androidpublisher.edits.bundles.upload({
    packageName,
    editId: edit.id,
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(aabPath)
    }
  });
  console.log(`  Uploaded bundle: version code ${bundle.versionCode}`);

  // Assign to track
  await androidpublisher.edits.tracks.update({
    packageName,
    editId: edit.id,
    track,
    requestBody: {
      releases: [{
        versionCodes: [bundle.versionCode.toString()],
        status: 'completed',
        releaseNotes: [{
          language: 'en-US',
          text: 'New build with corrected signing key and AI-powered features.'
        }]
      }]
    }
  });
  console.log(`  Assigned to ${track} track`);

  // Commit
  await androidpublisher.edits.commit({ packageName, editId: edit.id });
  console.log(`  ✓ Committed to Google Play!`);
  
  return bundle.versionCode;
}

async function main() {
  console.log('=== DOWNLOADING BUILDS FROM GITHUB ===\n');
  
  const octokit = new Octokit({ auth: await getGitHubToken() });
  
  const riderPath = await downloadArtifact(octokit, 't-ride-aab');
  const driverPath = await downloadArtifact(octokit, 't-driver-aab');
  
  console.log('\n=== UPLOADING TO GOOGLE PLAY (internal track) ===\n');
  
  console.log('T Ride (com.travony.rider):');
  try {
    await uploadToPlayStore('com.travony.rider', riderPath, 'internal');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  
  console.log('\nT Driver (com.travony.driver):');
  try {
    await uploadToPlayStore('com.travony.driver', driverPath, 'internal');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  
  console.log('\n=== DONE ===');
  console.log('Check Google Play Console for both apps!');
}

main().catch(e => console.error('Error:', e.message));
