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

async function pushFile(octokit: Octokit, owner: string, repo: string, path: string, content: string, message: string) {
  try {
    // Check if file exists
    const { data: existing } = await octokit.repos.getContent({ owner, repo, path }).catch(() => ({ data: null }));
    
    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path, message,
      content: Buffer.from(content).toString('base64'),
      sha: (existing as any)?.sha
    });
    console.log(`✓ ${path}`);
  } catch (e: any) {
    console.log(`✗ ${path}: ${e.message}`);
  }
}

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const owner = 'HorseChain', repo = 'travony';
  
  console.log('Pushing new workflows to GitHub...\n');
  
  await pushFile(octokit, owner, repo, 
    '.github/workflows/code-scanning.yml',
    fs.readFileSync('.github/workflows/code-scanning.yml', 'utf8'),
    'Add AI-powered code scanning workflow'
  );
  
  await pushFile(octokit, owner, repo,
    '.github/workflows/release-notes.yml', 
    fs.readFileSync('.github/workflows/release-notes.yml', 'utf8'),
    'Add AI release notes generator workflow'
  );
  
  console.log('\n=== Build Status ===');
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', per_page: 3
  });
  
  for (const run of runs.workflow_runs.slice(0, 2)) {
    console.log(`Run #${run.run_number}: ${run.status} (${run.conclusion || 'in progress'})`);
  }
}

main().catch(e => { console.error('Error:', e.message); });
