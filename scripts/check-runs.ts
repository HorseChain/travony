import { Octokit } from '@octokit/rest';

let connectionSettings: any;
async function getAccessToken() {
  if (connectionSettings?.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) return connectionSettings.settings.access_token;
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? 'depl ' + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  connectionSettings = await fetch('https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github', { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }).then(res => res.json()).then(data => data.items?.[0]);
  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({ owner: 'HorseChain', repo: 'travony', per_page: 5 });
  console.log('=== GitHub Actions Status ===');
  for (const run of runs.workflow_runs) {
    const st = run.status === 'in_progress' || run.status === 'queued' ? 'RUNNING' : run.conclusion === 'success' ? 'SUCCESS' : run.conclusion === 'failure' ? 'FAILED' : (run.status || '').toUpperCase();
    console.log(`[${st}] #${run.run_number} (${run.event}) - ${run.html_url}`);
  }
}
main().catch(e => console.error(e.message));
