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

async function pushFile(octokit: Octokit, owner: string, repo: string, branch: string, filePath: string, baseDir: string): Promise<boolean> {
  const fullPath = path.join(baseDir, filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  const content = fs.readFileSync(fullPath).toString('base64');
  
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: branch });
    if (!Array.isArray(data) && 'sha' in data) sha = data.sha;
  } catch {}

  try {
    const params: any = { owner, repo, path: filePath, message: `v4.5.0: ${filePath}`, content, branch };
    if (sha) params.sha = sha;
    await octokit.rest.repos.createOrUpdateFileContents(params);
    return true;
  } catch (e: any) {
    if (e.status === 409 || e.status === 422) {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: branch });
        if (!Array.isArray(data) && 'sha' in data) {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner, repo, path: filePath, message: `v4.5.0: ${filePath}`, content, sha: data.sha, branch
          });
          return true;
        }
      } catch {}
    }
    console.log(`  FAIL ${filePath}: ${e.status}`);
    return false;
  }
}

async function main() {
  console.log('=== Pushing remaining v4.5.0 files ===\n');

  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  const owner = 'HorseChain';
  const repoName = 'travony';
  const branch = 'main';
  const baseDir = '/home/runner/workspace';

  const remainingFiles = [
    '.github/workflows/build-android.yml',
    ...fs.readdirSync(path.join(baseDir, 'client/screens'))
      .filter(f => f.endsWith('.tsx'))
      .map(f => `client/screens/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/screens/driver'))
      .filter(f => f.endsWith('.tsx'))
      .map(f => `client/screens/driver/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/components'))
      .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map(f => `client/components/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/components/driver'))
      .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map(f => `client/components/driver/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/hooks'))
      .filter(f => f.endsWith('.ts'))
      .map(f => `client/hooks/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/constants'))
      .filter(f => f.endsWith('.ts'))
      .map(f => `client/constants/${f}`),
    ...fs.readdirSync(path.join(baseDir, 'client/navigation'))
      .filter(f => f.endsWith('.tsx'))
      .map(f => `client/navigation/${f}`),
    ...(fs.existsSync(path.join(baseDir, 'client/navigation/driver')) 
      ? fs.readdirSync(path.join(baseDir, 'client/navigation/driver'))
          .filter(f => f.endsWith('.tsx'))
          .map(f => `client/navigation/driver/${f}`)
      : []),
    'client/App.tsx',
    'client/lib/query-client.ts',
    'client/lib/appVariant.ts',
  ];

  const unique = [...new Set(remainingFiles)];
  console.log(`Files to push: ${unique.length}\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < unique.length; i++) {
    const success = await pushFile(octokit, owner, repoName, branch, unique[i], baseDir);
    if (success) { ok++; process.stdout.write(`\r  [${i+1}/${unique.length}] ${ok} OK`); }
    else fail++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n=== Remaining push: ${ok} OK, ${fail} FAIL ===\n`);

  console.log('Triggering build...');
  await new Promise(r => setTimeout(r, 3000));

  try {
    const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({ owner, repo: repoName });
    const bw = workflows.workflows.find(w => w.name.includes('Build') || w.name.includes('AAB'));
    if (bw) {
      await octokit.rest.actions.createWorkflowDispatch({
        owner, repo: repoName, workflow_id: bw.id, ref: branch,
        inputs: { app_variant: 'both', publish_track: 'none' }
      });
      console.log(`"${bw.name}" triggered!`);
    }
  } catch (e: any) {
    console.log(`Trigger: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 10000));
  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo: repoName, per_page: 3 });
  console.log('\n=== Latest Runs ===');
  for (const run of runs.workflow_runs.slice(0, 3)) {
    const st = run.status === 'in_progress' || run.status === 'queued' ? 'RUNNING' : run.conclusion || run.status;
    console.log(`  [${st}] #${run.run_number} ${run.html_url}`);
  }
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
