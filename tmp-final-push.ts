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

function gitBlobHash(buf: Buffer): string {
  const header = `blob ${buf.length}\0`;
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header), buf])).digest('hex');
}

async function uploadBlob(octokit: any, owner: string, repo: string, filePath: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 8000));
      } else {
        console.log(`  FAILED: ${filePath} - ${e.message}`);
        return null;
      }
    }
  }
  return null;
}

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  if (!travonyRepo) throw new Error("Repo not found");
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  // Get remote tree
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;
  const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
  const remoteTreeSha = remoteCommit.data.tree.sha;
  
  const remoteTree = await octokit.git.getTree({ owner, repo, tree_sha: remoteTreeSha, recursive: 'true' });
  const remoteFileShas = new Map<string, string>();
  for (const item of remoteTree.data.tree) {
    if (item.type === 'blob') remoteFileShas.set(item.path!, item.sha!);
  }
  console.log(`Remote files: ${remoteFileShas.size}`);

  // Get local files (excluding secrets and non-essential)
  const { exec } = require('child_process');
  const allFilesRaw = await new Promise<string>((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50 * 1024 * 1024 }, 
      (_: any, stdout: string) => resolve(stdout || ""));
  });
  const allFiles = allFilesRaw.trim().split('\n').filter(Boolean);
  
  const excludePatterns = ['replit-publisher-084dbaff4147', 'tmp-'];
  const localFiles = allFiles.filter(f => !excludePatterns.some(p => f.includes(p)));
  console.log(`Local files: ${localFiles.length}`);

  // Find changed files
  const changedFiles: string[] = [];
  for (const f of localFiles) {
    if (!fs.existsSync(f)) continue;
    const localSha = gitBlobHash(fs.readFileSync(f));
    const remoteSha = remoteFileShas.get(f);
    if (!remoteSha || localSha !== remoteSha) {
      changedFiles.push(f);
    }
  }
  
  // Find deleted files (on remote but not local)
  const localFileSet = new Set(localFiles);
  const deletedFiles = [...remoteFileShas.keys()].filter(f => 
    !localFileSet.has(f) && !excludePatterns.some(p => f.includes(p))
  );
  
  console.log(`Changed/New: ${changedFiles.length}, Deleted: ${deletedFiles.length}`);
  
  if (changedFiles.length === 0 && deletedFiles.length === 0) {
    console.log("Nothing to push, triggering builds...");
  } else {
    console.log("\nChanged files:");
    changedFiles.forEach(f => console.log(`  + ${f}`));
    deletedFiles.forEach(f => console.log(`  - ${f}`));
    
    // Upload changed files in batches with careful rate limiting
    const treeItems: any[] = [];
    const BATCH_SIZE = 8;
    
    for (let i = 0; i < changedFiles.length; i += BATCH_SIZE) {
      const batch = changedFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (f) => {
          const sha = await uploadBlob(octokit, owner, repo, f);
          if (!sha) return null;
          const stats = fs.statSync(f);
          return {
            path: f,
            mode: (stats.mode & 0o111) ? '100755' : '100644',
            type: 'blob',
            sha,
          };
        })
      );
      treeItems.push(...results.filter(r => r !== null));
      console.log(`  Uploaded ${Math.min(i + BATCH_SIZE, changedFiles.length)}/${changedFiles.length}`);
      
      if (i + BATCH_SIZE < changedFiles.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Add deletions
    for (const f of deletedFiles) {
      treeItems.push({ path: f, mode: '100644', type: 'blob', sha: null });
    }
    
    console.log(`\nCreating tree (${treeItems.length} items, base: ${remoteTreeSha})...`);
    const tree = await octokit.git.createTree({
      owner, repo,
      base_tree: remoteTreeSha,
      tree: treeItems,
    });
    console.log(`Tree: ${tree.data.sha}`);
    
    const commit = await octokit.git.createCommit({
      owner, repo,
      message: `v4.0.0 (versionCode 39) Build #27 - Dark mode, Ghost Mode, Ride Truth Engine, Help & Support, PMGTH, IBM, legal updates`,
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
    console.log("Branch updated successfully!");
  }
  
  // Trigger builds
  console.log("\n=== TRIGGERING BUILDS ===");
  await new Promise(r => setTimeout(r, 3000));
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered for BOTH T Ride and T Driver!");
  
  await new Promise(r => setTimeout(r, 8000));
  
  const runs = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: "build-android.yml", per_page: 5,
  });
  
  console.log("\nLatest workflow runs:");
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | Status: ${r.status} | URL: ${r.html_url}`);
  }
  
  const rl = await octokit.rateLimit.get();
  console.log(`\nRate limit remaining: ${rl.data.rate.remaining}/${rl.data.rate.limit}`);
  console.log("\nALL DONE!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
