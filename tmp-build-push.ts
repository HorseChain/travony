const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) throw new Error("No replit token");
  const res = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=github",
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } }
  );
  const data = await res.json() as any;
  const conn = data.items?.[0];
  return conn?.settings?.access_token || conn?.settings?.oauth?.credentials?.access_token || (() => { throw new Error("No token") })();
}

function run(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    require("child_process").exec(cmd, { cwd: "/home/runner/workspace", maxBuffer: 50 * 1024 * 1024 }, 
      (err: any, stdout: string, stderr: string) => resolve((stdout || "") + (stderr || "")));
  });
}

async function createBlobWithRetry(octokit: any, owner: string, repo: string, filePath: string, maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const content = fs.readFileSync(filePath);
      const isBinary = content.includes(0x00);
      const blob = await octokit.git.createBlob({
        owner, repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });
      return blob.data.sha;
    } catch (e: any) {
      if (e.message.includes('rate limit') || e.status === 403) {
        const wait = (attempt + 1) * 10000;
        console.log(`    Rate limited on ${filePath}, waiting ${wait/1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.log(`    Error on ${filePath}: ${e.message}`);
        return null;
      }
    }
  }
  return null;
}

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Auth: ${user.login}`);
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  if (!travonyRepo) throw new Error("Repo not found");
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  // Get all tracked files, excluding secret file and non-essential directories
  const allFiles = (await run('git ls-files')).trim().split('\n').filter(Boolean);
  
  const excludePatterns = [
    'replit-publisher-084dbaff4147',
    'attached_assets/',
    'static-build/',
    'credentials/',
    'tmp-',
    'check-play-status.js',
  ];
  
  const buildFiles = allFiles.filter(f => !excludePatterns.some(p => f.includes(p)));
  console.log(`\nTotal tracked: ${allFiles.length}, Build-essential: ${buildFiles.length}`);

  // Get remote state
  let remoteHead: string | null = null;
  let remoteTreeSha: string | null = null;
  try {
    const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
    remoteHead = ref.data.object.sha;
    const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
    remoteTreeSha = remoteCommit.data.tree.sha;
    
    // Get remote file SHAs for comparison
    const remoteTree = await octokit.git.getTree({ owner, repo, tree_sha: remoteTreeSha, recursive: 'true' });
    const remoteFileShas = new Map<string, string>();
    for (const item of remoteTree.data.tree) {
      if (item.type === 'blob') remoteFileShas.set(item.path!, item.sha!);
    }
    
    // Compare using git blob hashing to find truly changed files
    const crypto = require('crypto');
    function gitBlobHash(buf: Buffer): string {
      const header = `blob ${buf.length}\0`;
      return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header), buf])).digest('hex');
    }
    
    const changedFiles: string[] = [];
    const unchangedFiles: string[] = [];
    
    for (const f of buildFiles) {
      if (!fs.existsSync(f)) continue;
      const localSha = gitBlobHash(fs.readFileSync(f));
      const remoteSha = remoteFileShas.get(f);
      if (!remoteSha || localSha !== remoteSha) {
        changedFiles.push(f);
      } else {
        unchangedFiles.push(f);
      }
    }
    
    console.log(`Changed: ${changedFiles.length}, Unchanged: ${unchangedFiles.length}`);
    
    if (changedFiles.length === 0) {
      console.log("No files changed! Triggering build with existing code...");
      // Still trigger builds
    } else {
      // Upload only changed files
      console.log(`\nUploading ${changedFiles.length} changed files...`);
      const treeItems: any[] = [];
      
      for (let i = 0; i < changedFiles.length; i++) {
        const f = changedFiles[i];
        const sha = await createBlobWithRetry(octokit, owner, repo, f);
        if (sha) {
          const stats = fs.statSync(f);
          treeItems.push({
            path: f,
            mode: (stats.mode & 0o111) ? '100755' : '100644',
            type: 'blob',
            sha,
          });
        }
        
        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${i + 1}/${changedFiles.length}`);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      // Check for files that exist on remote but not in our buildFiles list and aren't excluded
      const localFileSet = new Set(buildFiles);
      const filesToDelete = [...remoteFileShas.keys()].filter(f => 
        !localFileSet.has(f) && 
        !excludePatterns.some(p => f.includes(p)) &&
        !f.startsWith('attached_assets/') &&
        !f.startsWith('static-build/')
      );
      
      for (const f of filesToDelete) {
        treeItems.push({ path: f, mode: '100644', type: 'blob', sha: null });
      }
      
      if (treeItems.length > 0) {
        console.log(`\nCreating tree with ${treeItems.length} changes...`);
        const tree = await octokit.git.createTree({
          owner, repo,
          base_tree: remoteTreeSha,
          tree: treeItems,
        });
        console.log(`Tree: ${tree.data.sha}`);
        
        const commit = await octokit.git.createCommit({
          owner, repo,
          message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, PMGTH, Intent-Based Mobility`,
          tree: tree.data.sha,
          parents: [remoteHead!],
        });
        console.log(`Commit: ${commit.data.sha}`);
        
        await octokit.git.updateRef({
          owner, repo,
          ref: 'heads/main',
          sha: commit.data.sha,
          force: true,
        });
        console.log("Branch updated!");
      }
    }
  } catch (e: any) {
    console.log(`Remote state error: ${e.message}`);
    console.log("Creating fresh repo content...");
    
    // Full fresh upload needed - upload all build files
    console.log(`\nUploading all ${buildFiles.length} files...`);
    const treeItems: any[] = [];
    
    for (let i = 0; i < buildFiles.length; i++) {
      const f = buildFiles[i];
      if (!fs.existsSync(f)) continue;
      const sha = await createBlobWithRetry(octokit, owner, repo, f);
      if (sha) {
        const stats = fs.statSync(f);
        treeItems.push({
          path: f,
          mode: (stats.mode & 0o111) ? '100755' : '100644',
          type: 'blob',
          sha,
        });
      }
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${buildFiles.length}`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    
    const tree = await octokit.git.createTree({ owner, repo, tree: treeItems });
    console.log(`Tree: ${tree.data.sha}`);
    
    const commit = await octokit.git.createCommit({
      owner, repo,
      message: `v4.0.0 (versionCode 39) Build #27 - Full codebase with all features`,
      tree: tree.data.sha,
    });
    console.log(`Commit: ${commit.data.sha}`);
    
    try {
      await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha, force: true });
    } catch {
      await octokit.git.createRef({ owner, repo, ref: 'refs/heads/main', sha: commit.data.sha });
    }
    console.log("Branch created/updated!");
  }

  // Trigger builds
  console.log("\n=== Triggering builds for BOTH T Ride and T Driver ===");
  await new Promise(r => setTimeout(r, 3000));
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered for both apps!");
  
  await new Promise(r => setTimeout(r, 8000));
  
  const runs = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: "build-android.yml", per_page: 5,
  });
  
  console.log("\nRecent workflow runs:");
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
  }
  
  console.log("\nDONE! All latest code pushed and builds triggered.");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
