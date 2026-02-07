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
  
  // First find the correct repo
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 10 });
  console.log('Your repos:', repos.map(r => r.full_name).join(', '));
  
  const travonyRepo = repos.find(r => r.name.toLowerCase().includes('travony'));
  if (!travonyRepo) {
    console.log('Could not find Travony repo');
    return;
  }
  
  const [owner, repo] = travonyRepo.full_name.split('/');
  console.log(`\nUsing repo: ${owner}/${repo}`);
  console.log(`Permissions: ${JSON.stringify(travonyRepo.permissions)}`);
  
  // Check existing workflows
  try {
    const { data: contents } = await octokit.repos.getContent({
      owner, repo, path: '.github/workflows'
    });
    console.log('\nExisting workflows:', Array.isArray(contents) ? contents.map((c: any) => c.name).join(', ') : 'none');
  } catch (e: any) {
    console.log('\nNo existing workflows directory');
  }
  
  // Check build status
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', per_page: 2
  });
  
  console.log('\n=== Build Status ===');
  for (const run of runs.workflow_runs) {
    const started = new Date(run.created_at);
    const elapsed = Math.round((Date.now() - started.getTime()) / 60000);
    console.log(`Run #${run.run_number}: ${run.status} (${run.conclusion || `running ${elapsed}min`})`);
    console.log(`  URL: ${run.html_url}`);
  }
}

main().catch(e => { console.error('Error:', e.message); });
