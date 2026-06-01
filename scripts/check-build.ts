import { Octokit } from '@octokit/rest';

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
  const octokit = new Octokit({ auth: accessToken });
  const owner = 'HorseChain';
  const repo = 'travony';
  
  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner, repo, per_page: 3
  });
  
  for (const run of runs.workflow_runs) {
    console.log(`\n=== Run #${run.run_number} (${run.event}) ===`);
    console.log(`Status: ${run.status} | Conclusion: ${run.conclusion || 'pending'}`);
    console.log(`URL: ${run.html_url}`);
    
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner, repo, run_id: run.id
    });
    
    for (const job of jobs.jobs) {
      console.log(`\n  Job: ${job.name}`);
      console.log(`  Status: ${job.status} | Conclusion: ${job.conclusion || 'running'}`);
      
      if (job.steps) {
        for (const step of job.steps) {
          const icon = step.conclusion === 'success' ? 'OK' : 
                       step.conclusion === 'failure' ? 'FAIL' :
                       step.status === 'in_progress' ? 'RUNNING' : 'PENDING';
          if (step.status !== 'queued' || step.conclusion) {
            console.log(`    [${icon}] ${step.name}`);
          }
        }
      }
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
