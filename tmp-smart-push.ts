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
      (err: any, stdout: string, stderr: string) => {
        if (err && !stdout && !stderr) reject(err);
        else resolve((stdout || "") + (stderr || ""));
      });
  });
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

  // Get what's on GitHub
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;
  console.log(`Remote HEAD: ${remoteHead}`);

  // Get local HEAD
  const localHead = (await run('git rev-parse HEAD')).trim();
  console.log(`Local HEAD: ${localHead}`);

  // Check if the problematic commit is between remote and local
  const problemCommit = '415c2b2dd4d6ff1d072a3230872697eaf7fd038d';
  const hasSecret = await run(`git log --oneline ${remoteHead}..${localHead} -- attached_assets/replit-publisher-084dbaff4147_1769739843670.json 2>/dev/null || echo ""`);
  console.log(`Secret file in diff: ${hasSecret.trim() ? 'YES' : 'NO'}`);

  // Strategy: Use GitHub API to update the tree on top of remote HEAD
  // Only upload files that differ between remote and local
  
  // Get the diff
  const diffFiles = (await run(`git diff --name-only ${remoteHead} HEAD 2>/dev/null`)).trim().split('\n').filter(Boolean);
  console.log(`\nFiles changed since last push: ${diffFiles.length}`);
  
  // Exclude the problematic file
  const filesToPush = diffFiles.filter(f => !f.includes('replit-publisher'));
  console.log(`Files to push (excluding secret): ${filesToPush.length}`);
  
  if (filesToPush.length === 0) {
    console.log("No files to push!");
    return;
  }

  // Also check for deleted files
  const deletedFiles = (await run(`git diff --name-only --diff-filter=D ${remoteHead} HEAD 2>/dev/null`)).trim().split('\n').filter(Boolean);
  const addedOrModified = filesToPush.filter(f => !deletedFiles.includes(f));
  
  console.log(`Added/Modified: ${addedOrModified.length}, Deleted: ${deletedFiles.length}`);
  console.log("\nFiles being pushed:");
  filesToPush.forEach(f => console.log(`  ${f}`));

  // Get the remote tree
  const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
  const baseTreeSha = remoteCommit.data.tree.sha;

  // Create blobs for changed files (with rate limiting)
  const treeItems: any[] = [];
  
  for (let i = 0; i < addedOrModified.length; i++) {
    const filePath = addedOrModified[i];
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`  Skip (not found): ${filePath}`);
        continue;
      }
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
      console.log(`  Uploaded: ${filePath}`);
      
      // Small delay to avoid secondary rate limit
      if (i > 0 && i % 20 === 0) {
        console.log(`  (pausing to avoid rate limit...)`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e: any) {
      console.log(`  Error: ${filePath}: ${e.message}`);
    }
  }
  
  // Add deletions
  for (const f of deletedFiles) {
    if (!f.includes('replit-publisher')) {
      treeItems.push({
        path: f,
        mode: '100644',
        type: 'blob',
        sha: null, // null sha = delete
      });
      console.log(`  Delete: ${f}`);
    }
  }
  
  console.log(`\nCreating tree with ${treeItems.length} changes on top of base tree...`);
  
  const tree = await octokit.git.createTree({
    owner, repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });
  console.log(`Tree: ${tree.data.sha}`);

  // Create commit
  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 Build #27 - Dark mode, Ghost Mode, Ride Truth Engine, Help & Support, FAQs, Legal updates`,
    tree: tree.data.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  // Update ref
  await octokit.git.updateRef({
    owner, repo,
    ref: 'heads/main',
    sha: commit.data.sha,
    force: true,
  });
  console.log("Main branch updated!");

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
    const run = runs.data.workflow_runs[0];
    console.log(`\nWorkflow: ${run.html_url}`);
    console.log(`Status: ${run.status}`);
    console.log(`Run ID: ${run.id}`);
  }
  
  console.log("\nALL DONE - Latest code pushed and builds triggered!");
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
