import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

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

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const owner = 'HorseChain', repo = 'travony';
  
  // Get current main branch SHA
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const mainSha = ref.object.sha;
  
  // Get current tree
  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: mainSha });
  
  // Create new files
  const files = [
    { path: '.github/workflows/code-scanning.yml', content: fs.readFileSync('.github/workflows/code-scanning.yml', 'utf8') },
    { path: '.github/workflows/release-notes.yml', content: fs.readFileSync('.github/workflows/release-notes.yml', 'utf8') }
  ];
  
  // Create blobs for each file
  const blobs = await Promise.all(files.map(async file => {
    const { data: blob } = await octokit.git.createBlob({
      owner, repo, content: Buffer.from(file.content).toString('base64'), encoding: 'base64'
    });
    return { path: file.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha };
  }));
  
  // Create tree
  const { data: tree } = await octokit.git.createTree({
    owner, repo, base_tree: commit.tree.sha, tree: blobs
  });
  
  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: 'Add AI-powered code scanning and release notes workflows',
    tree: tree.sha,
    parents: [mainSha]
  });
  
  // Update ref
  await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: newCommit.sha });
  
  console.log('✓ Pushed new workflows to GitHub!');
  console.log(`  Commit: ${newCommit.sha.substring(0, 7)}`);
  console.log('');
  console.log('New workflows added:');
  console.log('  1. code-scanning.yml - AI-powered security analysis');
  console.log('     - CodeQL for JavaScript/TypeScript');
  console.log('     - Dependency vulnerability scanning');
  console.log('     - Secret detection');
  console.log('     - ESLint security rules');
  console.log('');
  console.log('  2. release-notes.yml - AI release notes generator');
  console.log('     - Automatically categorizes commits');
  console.log('     - Creates structured release notes');
  console.log('     - Runs on version tags (v*)');
  console.log('');
  
  // Check build status
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', per_page: 1
  });
  
  const latestRun = runs.workflow_runs[0];
  console.log(`Android Build Status: ${latestRun.status} (${latestRun.conclusion || 'running'})`);
  console.log(`  URL: ${latestRun.html_url}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
