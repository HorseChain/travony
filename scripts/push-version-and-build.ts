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

async function updateFile(octokit: Octokit, owner: string, repo: string, path: string, content: string, message: string) {
  // Get current file SHA
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    sha = (data as any).sha;
  } catch {}
  
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path, message,
    content: Buffer.from(content).toString('base64'),
    sha
  });
}

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const owner = 'HorseChain', repo = 'travony';
  
  console.log('Pushing version code updates to GitHub...');
  
  // Update app.rider.json
  await updateFile(octokit, owner, repo, 'app.rider.json', 
    fs.readFileSync('app.rider.json', 'utf8'),
    'Bump T Ride version code to 36');
  console.log('✓ Updated app.rider.json');
  
  // Update app.driver.json
  await updateFile(octokit, owner, repo, 'app.driver.json',
    fs.readFileSync('app.driver.json', 'utf8'),
    'Bump T Driver version code to 36');
  console.log('✓ Updated app.driver.json');
  
  // Cancel any running builds
  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'build-android.yml', status: 'in_progress'
  });
  
  for (const run of runs.workflow_runs) {
    await octokit.actions.cancelWorkflowRun({ owner, repo, run_id: run.id });
    console.log(`Cancelled run #${run.run_number}`);
  }
  
  // Wait a moment
  await new Promise(r => setTimeout(r, 2000));
  
  // Trigger new build
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: 'build-android.yml', ref: 'main',
    inputs: { app_variant: 'both', publish_track: 'none' }
  });
  
  console.log('\n✓ New build triggered with version code 36!');
  console.log('Check: https://github.com/HorseChain/travony/actions');
}

main().catch(e => console.error('Error:', e.message));
