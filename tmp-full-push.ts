const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const crypto = require('crypto');

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
      (err: any, stdout: string, stderr: string) => {
        if (err && !stdout && !stderr) reject(err);
        else resolve((stdout || "") + (stderr || ""));
      });
  });
}

function gitBlobHash(content: Buffer): string {
  const header = `blob ${content.length}\0`;
  const store = Buffer.concat([Buffer.from(header), content]);
  return crypto.createHash('sha1').update(store).digest('hex');
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

  // Get remote tree recursively
  console.log("\nFetching remote file tree...");
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;
  const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
  const remoteTreeSha = remoteCommit.data.tree.sha;
  
  const remoteTree = await octokit.git.getTree({ owner, repo, tree_sha: remoteTreeSha, recursive: 'true' });
  const remoteFiles = new Map<string, string>();
  for (const item of remoteTree.data.tree) {
    if (item.type === 'blob') {
      remoteFiles.set(item.path!, item.sha!);
    }
  }
  console.log(`Remote has ${remoteFiles.size} files`);

  // Get all local tracked files
  const localFilesRaw = (await run('git ls-files')).trim().split('\n').filter(Boolean);
  
  // Exclude the secret file
  const excludePatterns = ['replit-publisher-084dbaff4147'];
  const localFiles = localFilesRaw.filter(f => !excludePatterns.some(p => f.includes(p)));
  console.log(`Local has ${localFiles.length} files (excluding secrets)`);

  // Compare: find files that are new or changed
  const changedFiles: string[] = [];
  const newFiles: string[] = [];
  const unchangedFiles: string[] = [];
  
  for (const filePath of localFiles) {
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath);
    const localSha = gitBlobHash(content);
    const remoteSha = remoteFiles.get(filePath);
    
    if (!remoteSha) {
      newFiles.push(filePath);
    } else if (localSha !== remoteSha) {
      changedFiles.push(filePath);
    } else {
      unchangedFiles.push(filePath);
    }
  }
  
  // Find deleted files
  const localFileSet = new Set(localFiles);
  const deletedFiles = [...remoteFiles.keys()].filter(f => !localFileSet.has(f) && !f.includes('replit-publisher'));
  
  console.log(`\nNew: ${newFiles.length}, Changed: ${changedFiles.length}, Unchanged: ${unchangedFiles.length}, Deleted: ${deletedFiles.length}`);
  
  const filesToUpload = [...changedFiles, ...newFiles];
  console.log(`\nFiles to upload (${filesToUpload.length}):`);
  filesToUpload.forEach(f => console.log(`  ${f}`));
  if (deletedFiles.length > 0) {
    console.log(`\nFiles to delete (${deletedFiles.length}):`);
    deletedFiles.forEach(f => console.log(`  ${f}`));
  }
  
  if (filesToUpload.length === 0 && deletedFiles.length === 0) {
    console.log("\nNo changes to push!");
    return;
  }

  // Upload blobs with rate limiting
  const treeItems: any[] = [];
  
  for (let i = 0; i < filesToUpload.length; i++) {
    const filePath = filesToUpload[i];
    try {
      const content = fs.readFileSync(filePath);
      const isBinary = content.includes(0x00);
      
      const blob = await octokit.git.createBlob({
        owner, repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });
      
      const stats = fs.statSync(filePath);
      treeItems.push({
        path: filePath,
        mode: (stats.mode & 0o111) ? '100755' : '100644',
        type: 'blob',
        sha: blob.data.sha,
      });
      
      // Rate limit: pause every 15 files
      if ((i + 1) % 15 === 0) {
        console.log(`  Uploaded ${i + 1}/${filesToUpload.length}... (pausing)`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e: any) {
      console.log(`  Error ${filePath}: ${e.message}`);
      // Wait and retry once
      await new Promise(r => setTimeout(r, 5000));
      try {
        const content = fs.readFileSync(filePath);
        const isBinary = content.includes(0x00);
        const blob = await octokit.git.createBlob({
          owner, repo,
          content: isBinary ? content.toString('base64') : content.toString('utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
        });
        const stats = fs.statSync(filePath);
        treeItems.push({
          path: filePath,
          mode: (stats.mode & 0o111) ? '100755' : '100644',
          type: 'blob',
          sha: blob.data.sha,
        });
        console.log(`  Retry OK: ${filePath}`);
      } catch (e2: any) {
        console.log(`  SKIP (failed twice): ${filePath}`);
      }
    }
  }
  
  // Add deletions
  for (const f of deletedFiles) {
    treeItems.push({ path: f, mode: '100644', type: 'blob', sha: null });
  }
  
  console.log(`\nCreating tree with ${treeItems.length} items (base: ${remoteTreeSha})...`);
  
  const tree = await octokit.git.createTree({
    owner, repo,
    base_tree: remoteTreeSha,
    tree: treeItems,
  });
  console.log(`Tree: ${tree.data.sha}`);

  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 Build #27 - All features: dark mode, Ghost Mode info, Ride Truth Engine, Help & Support overhaul, FAQs, legal updates`,
    tree: tree.data.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  await octokit.git.updateRef({
    owner, repo,
    ref: 'heads/main',
    sha: commit.data.sha,
    force: true,
  });
  console.log("Main branch updated successfully!");

  // Trigger builds
  console.log("\nTriggering builds for both T Ride and T Driver...");
  await new Promise(r => setTimeout(r, 2000));
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered!");
  
  await new Promise(r => setTimeout(r, 6000));
  
  const runs = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: "build-android.yml", per_page: 3,
  });
  if (runs.data.workflow_runs.length > 0) {
    const latestRun = runs.data.workflow_runs[0];
    console.log(`\nWorkflow: ${latestRun.html_url}`);
    console.log(`Status: ${latestRun.status}`);
    console.log(`Run ID: ${latestRun.id}`);
  }
  
  console.log("\nALL DONE!");
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
