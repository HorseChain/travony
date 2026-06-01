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

function collectFiles(baseDir: string, dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const fullDir = path.join(baseDir, dir);
  if (!fs.existsSync(fullDir)) return files;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.expo', 'static-build', '.git', 'dist', 'server_dist'].includes(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(path.relative(baseDir, full));
      }
    }
  };
  walk(fullDir);
  return files;
}

async function pushFile(octokit: Octokit, owner: string, repo: string, branch: string, filePath: string, baseDir: string, commitMsg: string): Promise<boolean> {
  const fullPath = path.join(baseDir, filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  const content = fs.readFileSync(fullPath).toString('base64');
  
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: branch });
    if (!Array.isArray(data) && 'sha' in data) sha = data.sha;
  } catch {}

  try {
    const params: any = { owner, repo, path: filePath, message: commitMsg, content, branch };
    if (sha) params.sha = sha;
    await octokit.rest.repos.createOrUpdateFileContents(params);
    return true;
  } catch (e: any) {
    if (e.status === 409 || e.status === 422) {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: branch });
        if (!Array.isArray(data) && 'sha' in data) {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner, repo, path: filePath, message: commitMsg, content, sha: data.sha, branch
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
  console.log('=== Pushing Travony v4.5.1 OpenClaw Enhancements to GitHub ===\n');

  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  const owner = 'HorseChain';
  const repoName = 'travony';
  const branch = 'main';
  const baseDir = '/home/runner/workspace';

  const allFiles = [
    'app.json', 'app.rider.json', 'app.driver.json',
    'package.json', 'tsconfig.json', 'drizzle.config.ts',
    '.github/workflows/build-android.yml',
    ...collectFiles(baseDir, 'shared', ['.ts']),
    ...collectFiles(baseDir, 'server', ['.ts', '.html']),
    ...collectFiles(baseDir, 'client', ['.ts', '.tsx']),
  ];

  console.log(`Total files: ${allFiles.length}\n`);

  let ok = 0, fail = 0;
  
  for (let i = 0; i < allFiles.length; i++) {
    const f = allFiles[i];
    const success = await pushFile(octokit, owner, repoName, branch, f, baseDir, `v4.5.1 OpenClaw enhancements: ${f}`);
    if (success) { ok++; process.stdout.write(`\r  [${i+1}/${allFiles.length}] ${ok} OK`); }
    else fail++;
    
    if ((i + 1) % 20 === 0) await new Promise(r => setTimeout(r, 1000));
    else await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n=== Push: ${ok} OK, ${fail} FAIL ===\n`);

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
      console.log(`"${bw.name}" triggered!\n`);
    }
  } catch (e: any) {
    console.log(`Trigger error: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 10000));
  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo: repoName, per_page: 5 });
  console.log('=== Recent Runs ===');
  for (const run of runs.workflow_runs.slice(0, 5)) {
    const st = run.status === 'in_progress' || run.status === 'queued' ? 'RUNNING' : run.conclusion === 'success' ? 'SUCCESS' : run.conclusion === 'failure' ? 'FAILED' : (run.status || '').toUpperCase();
    console.log(`  [${st}] #${run.run_number} ${run.html_url}`);
  }
  console.log('\n=== v4.5.1 Complete ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
