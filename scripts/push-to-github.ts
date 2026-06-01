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

async function main() {
  console.log('=== Pushing AAB 33 Build Config to GitHub ===\n');
  
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  const owner = 'HorseChain';
  const repoName = 'travony';
  const branch = 'main';
  console.log(`Repo: ${owner}/${repoName} (branch: ${branch})\n`);
  
  // Check if .github/workflows directory exists
  console.log('Checking .github/workflows on GitHub...');
  let workflowSha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner, repo: repoName, 
      path: '.github/workflows/build-android.yml',
      ref: branch
    });
    if (!Array.isArray(data)) {
      workflowSha = data.sha;
      console.log(`  Workflow file exists on GitHub (SHA: ${workflowSha.substring(0, 7)})`);
    }
  } catch (e: any) {
    console.log(`  Workflow file NOT found on GitHub (${e.status})`);
  }
  
  // Try pushing the workflow file
  console.log('\nPushing .github/workflows/build-android.yml...');
  const workflowContent = fs.readFileSync('/home/runner/workspace/.github/workflows/build-android.yml');
  
  try {
    const params: any = {
      owner, repo: repoName,
      path: '.github/workflows/build-android.yml',
      message: 'Update build workflow - AAB 33 targetSdkVersion with latest keystores\n\nT Ride: v4.2.0 (versionCode 42)\nT Driver: v4.3.0 (versionCode 43)\n\n- Proper signing config via gradle.properties + findProperty()\n- targetSdkVersion 33, compileSdkVersion 34\n- Keystore validation, build verification\n- Both apps build in parallel',
      content: workflowContent.toString('base64'),
      branch
    };
    if (workflowSha) params.sha = workflowSha;
    
    const { data } = await octokit.rest.repos.createOrUpdateFileContents(params);
    console.log(`  Committed: ${data.commit.sha?.substring(0, 7)}`);
    console.log('  Workflow file pushed successfully!\n');
  } catch (e: any) {
    console.log(`  Push via Contents API failed (${e.status}): ${e.message}`);
    console.log('  Trying direct API call...');
    
    // Try using raw fetch as fallback
    const body: any = {
      message: 'Update build workflow - AAB 33 with latest keystores',
      content: workflowContent.toString('base64'),
      branch
    };
    if (workflowSha) body.sha = workflowSha;
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/.github/workflows/build-android.yml`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(body)
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log(`  Direct push successful: ${data.commit?.sha?.substring(0, 7)}`);
    } else {
      const errText = await response.text();
      console.log(`  Direct push failed (${response.status}): ${errText}`);
      console.log('\n  Trying workflow_dispatch instead...');
      
      // List workflows
      const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({
        owner, repo: repoName
      });
      console.log('  Available workflows:');
      for (const wf of workflows.workflows) {
        console.log(`    - ${wf.name} (id: ${wf.id}, state: ${wf.state})`);
      }
      
      const buildWorkflow = workflows.workflows.find(w => w.name === 'Build Android AAB');
      if (buildWorkflow) {
        console.log(`\n  Triggering workflow_dispatch for "${buildWorkflow.name}"...`);
        await octokit.rest.actions.createWorkflowDispatch({
          owner, repo: repoName,
          workflow_id: buildWorkflow.id,
          ref: branch,
          inputs: {
            app_variant: 'both',
            publish_track: 'none'
          }
        });
        console.log('  Workflow dispatch triggered successfully!');
      } else {
        console.log('  WARNING: Build workflow not found on GitHub.');
        console.log('  You need to push the workflow file manually via Replit Git panel.');
      }
    }
  }
  
  // Wait and check runs
  console.log('\nWaiting 10s for workflows to start...');
  await new Promise(r => setTimeout(r, 10000));
  
  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner, repo: repoName,
    per_page: 8
  });
  
  console.log('\n=== Recent Workflow Runs ===');
  for (const run of runs.workflow_runs.slice(0, 5)) {
    const icon = (run.status === 'in_progress' || run.status === 'queued') ? 'RUNNING' : 
                 run.conclusion === 'success' ? 'SUCCESS' : 
                 run.conclusion === 'failure' ? 'FAILED' : run.status?.toUpperCase();
    console.log(`  [${icon}] ${run.name} #${run.run_number} (${run.event})`);
    console.log(`     Status: ${run.status} | ${run.conclusion || 'in progress'}`);
    console.log(`     URL: ${run.html_url}`);
    
    if (run.status === 'in_progress' || run.status === 'queued') {
      try {
        const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
          owner, repo: repoName, run_id: run.id
        });
        for (const job of jobs.jobs) {
          console.log(`     Job: ${job.name} - ${job.status}`);
        }
      } catch {}
    }
    console.log('');
  }
  
  console.log('=== DONE ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
