import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

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
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

async function main() {
  const accessToken = await getAccessToken();
  const owner = 'HorseChain';
  const repo = 'travony';
  const branch = 'main';
  
  // Use the raw GitHub API to get the latest commit
  const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers: { 'Authorization': `token ${accessToken}`, 'Accept': 'application/vnd.github+json' }
  });
  const refData = await refResp.json();
  const latestSha = refData.object.sha;
  console.log(`Latest commit: ${latestSha.substring(0, 7)}`);
  
  // Get the commit to find tree SHA
  const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestSha}`, {
    headers: { 'Authorization': `token ${accessToken}`, 'Accept': 'application/vnd.github+json' }
  });
  const commitData = await commitResp.json();
  const treeSha = commitData.tree.sha;
  console.log(`Tree SHA: ${treeSha.substring(0, 7)}`);
  
  // Create blob for the workflow file
  const workflowContent = fs.readFileSync('/home/runner/workspace/.github/workflows/build-android.yml');
  const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: { 
      'Authorization': `token ${accessToken}`, 
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: workflowContent.toString('base64'), encoding: 'base64' })
  });
  const blobData = await blobResp.json();
  console.log(`Blob created: ${blobData.sha?.substring(0, 7)}`);
  
  // Create tree
  const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { 
      'Authorization': `token ${accessToken}`, 
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      base_tree: treeSha,
      tree: [{ path: '.github/workflows/build-android.yml', mode: '100644', type: 'blob', sha: blobData.sha }]
    })
  });
  
  if (!treeResp.ok) {
    const err = await treeResp.text();
    console.log(`Tree creation failed (${treeResp.status}): ${err}`);
    console.log('\nThe workflow file needs to be pushed via the Replit Git panel.');
    console.log('However, the builds are already running using the EXISTING workflow on GitHub.');
    return;
  }
  
  const treeData = await treeResp.json();
  console.log(`Tree created: ${treeData.sha?.substring(0, 7)}`);
  
  // Create commit
  const newCommitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { 
      'Authorization': `token ${accessToken}`, 
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update build-android.yml - AAB 33 with proper signing',
      tree: treeData.sha,
      parents: [latestSha]
    })
  });
  const newCommitData = await newCommitResp.json();
  console.log(`Commit: ${newCommitData.sha?.substring(0, 7)}`);
  
  // Update ref
  const updateResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { 
      'Authorization': `token ${accessToken}`, 
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sha: newCommitData.sha })
  });
  
  if (updateResp.ok) {
    console.log('Workflow file pushed successfully!');
  } else {
    const err = await updateResp.text();
    console.log(`Ref update failed (${updateResp.status}): ${err}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
