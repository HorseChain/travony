import * as fs from 'fs';

let connectionSettings;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : null;

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );
  const data = await response.json();
  return data.items?.[0]?.settings?.access_token;
}

async function githubApiWithAuth(url, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  return { response, data: await response.json() };
}

async function main() {
  const owner = 'HorseChain';
  const repo = 'travony';
  
  const content = fs.readFileSync('/home/runner/workspace/.github/workflows/build-android.yml', 'utf-8');
  console.log('Pushing workflow file...');
  
  // Get latest commit
  const { data: refData } = await githubApiWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`);
  const latestCommitSha = refData.object.sha;
  console.log('Latest commit:', latestCommitSha);
  
  // Get the tree of latest commit
  const { data: commitData } = await githubApiWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`);
  const baseTreeSha = commitData.tree.sha;
  console.log('Base tree:', baseTreeSha);
  
  // Create new tree with the workflow file
  const { response: treeResp, data: treeData } = await githubApiWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{
        path: '.github/workflows/build-android.yml',
        mode: '100644',
        type: 'blob',
        content: content
      }]
    })
  });
  
  console.log('Tree creation:', treeResp.status, treeData.sha || treeData.message);
  
  if (!treeData.sha) {
    throw new Error('Tree creation failed');
  }
  
  // Create commit
  const { response: commitResp, data: newCommitData } = await githubApiWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Add GitHub Actions workflow for building AAB files',
      tree: treeData.sha,
      parents: [latestCommitSha]
    })
  });
  
  console.log('Commit creation:', commitResp.status, newCommitData.sha || newCommitData.message);
  
  if (!newCommitData.sha) {
    throw new Error('Commit creation failed');
  }
  
  // Update ref
  const { response: updateResp, data: updateData } = await githubApiWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: newCommitData.sha
    })
  });
  
  console.log('Ref update:', updateResp.status, updateData.object?.sha || updateData.message);
  
  console.log('\\nWorkflow file pushed successfully!');
  console.log('Now go to: https://github.com/HorseChain/travony/actions');
  console.log('Click "Build Android AAB" -> "Run workflow" -> Select "both"');
}

main().catch(e => console.error('Error:', e.message));
