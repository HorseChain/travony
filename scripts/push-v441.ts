import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

const FILES_TO_PUSH = [
  'replit.md',
  'shared/schema.ts',
  'server/errors.ts',
  'server/resilience.ts',
  'server/rideEventService.ts',
  'server/email.ts',
  'server/index.ts',
  'server/routes.ts',
  'client/lib/query-client.ts',
];

async function main() {
  console.log('=== Pushing Travony v4.4.1 (Production Resilience) to GitHub ===\n');
  
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  const owner = 'HorseChain';
  const repoName = 'travony';
  const branch = 'main';
  console.log(`Repo: ${owner}/${repoName} (branch: ${branch})`);
  console.log(`Files to push: ${FILES_TO_PUSH.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const filePath of FILES_TO_PUSH) {
    const fullPath = path.join('/home/runner/workspace', filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`  SKIP ${filePath} (not found)`);
      continue;
    }

    const content = fs.readFileSync(fullPath);
    const base64Content = content.toString('base64');

    let existingSha: string | undefined;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner, repo: repoName, path: filePath, ref: branch
      });
      if (!Array.isArray(data) && 'sha' in data) {
        existingSha = data.sha;
      }
    } catch (e: any) {
      if (e.status !== 404) {
        console.log(`  WARN checking ${filePath}: ${e.status}`);
      }
    }

    try {
      const params: any = {
        owner, repo: repoName,
        path: filePath,
        message: `v4.4.1: ${filePath}`,
        content: base64Content,
        branch
      };
      if (existingSha) params.sha = existingSha;

      await octokit.rest.repos.createOrUpdateFileContents(params);
      console.log(`  OK ${filePath}`);
      successCount++;
    } catch (e: any) {
      console.log(`  FAIL ${filePath}: ${e.status} - ${e.message?.substring(0, 80)}`);
      failCount++;
      
      if (e.status === 409) {
        console.log(`    Retrying with fresh SHA...`);
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner, repo: repoName, path: filePath, ref: branch
          });
          if (!Array.isArray(data) && 'sha' in data) {
            await octokit.rest.repos.createOrUpdateFileContents({
              owner, repo: repoName,
              path: filePath,
              message: `v4.4.1: ${filePath}`,
              content: base64Content,
              sha: data.sha,
              branch
            });
            console.log(`    RETRY OK ${filePath}`);
            successCount++;
            failCount--;
          }
        } catch (retryErr: any) {
          console.log(`    RETRY FAIL: ${retryErr.message?.substring(0, 80)}`);
        }
      }
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n=== Push Summary: ${successCount} OK, ${failCount} FAIL ===\n`);

  console.log('Waiting 5s then triggering build workflow...');
  await new Promise(r => setTimeout(r, 5000));

  try {
    const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({
      owner, repo: repoName
    });
    console.log('Available workflows:');
    for (const wf of workflows.workflows) {
      console.log(`  - ${wf.name} (id: ${wf.id}, state: ${wf.state})`);
    }

    const buildWorkflow = workflows.workflows.find(w => 
      w.name.includes('Build') || w.name.includes('build') || w.name.includes('AAB')
    );
    
    if (buildWorkflow) {
      console.log(`\nTriggering: "${buildWorkflow.name}"...`);
      await octokit.rest.actions.createWorkflowDispatch({
        owner, repo: repoName,
        workflow_id: buildWorkflow.id,
        ref: branch,
        inputs: {
          app_variant: 'both',
          publish_track: 'none'
        }
      });
      console.log('Build workflow triggered!\n');
    } else {
      console.log('\nNo build workflow found. Builds may auto-trigger from push.\n');
    }
  } catch (e: any) {
    console.log(`Workflow trigger error: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 10000));

  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner, repo: repoName, per_page: 5
  });

  console.log('=== Recent Workflow Runs ===');
  for (const run of runs.workflow_runs.slice(0, 5)) {
    const status = (run.status === 'in_progress' || run.status === 'queued') ? 'RUNNING' : 
                   run.conclusion === 'success' ? 'SUCCESS' : 
                   run.conclusion === 'failure' ? 'FAILED' : run.status?.toUpperCase();
    console.log(`  [${status}] ${run.name} #${run.run_number} (${run.event})`);
    console.log(`     ${run.status} | ${run.conclusion || 'in progress'}`);
    console.log(`     ${run.html_url}\n`);
  }

  console.log('=== v4.4.1 Push Complete ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
