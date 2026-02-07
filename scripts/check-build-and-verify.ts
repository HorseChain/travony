import { Octokit } from '@octokit/rest';

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
  
  console.log('=== CHECKING LATEST GITHUB BUILD STATUS ===\n');
  
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', per_page: 3
  });
  
  for (const run of runs.workflow_runs) {
    const duration = run.updated_at 
      ? Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 60000)
      : '?';
    console.log(`Run #${run.run_number}: ${run.status} (${run.conclusion || 'running'})`);
    console.log(`  Started: ${run.created_at}`);
    console.log(`  Duration: ${duration} min`);
    console.log(`  URL: ${run.html_url}`);
    
    if (run.status === 'completed' && run.conclusion === 'success') {
      const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
        owner, repo, run_id: run.id
      });
      console.log(`  Artifacts: ${artifacts.artifacts.map(a => a.name).join(', ')}`);
    }
    console.log();
  }
}

main().catch(e => { console.error('Error:', e.message); });
