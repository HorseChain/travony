const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const crypto = require('crypto');

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) throw new Error("No replit token");
  const res = await fetch("https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=github", { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } });
  const data = await res.json() as any;
  const conn = data.items?.[0];
  return conn?.settings?.access_token || conn?.settings?.oauth?.credentials?.access_token || (() => { throw new Error("No token") })();
}

function gitBlobHash(buf: Buffer): string {
  const header = `blob ${buf.length}\0`;
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header), buf])).digest('hex');
}

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  // Get remote state
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;

  // Get local files
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  
  const excludePatterns = ['replit-publisher-084dbaff4147', 'tmp-'];
  const localFiles = allFilesRaw.trim().split('\n')
    .filter((f: string) => f && !excludePatterns.some(p => f.includes(p)) && fs.existsSync(f));
  console.log(`Files to push: ${localFiles.length}`);

  // Upload ALL files as blobs and build tree
  const treeItems: any[] = [];
  let failed = 0;
  
  for (let i = 0; i < localFiles.length; i++) {
    const f = localFiles[i];
    let success = false;
    
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const content = fs.readFileSync(f);
        const isBinary = content.includes(0x00);
        const blob = await octokit.git.createBlob({
          owner, repo,
          content: isBinary ? content.toString('base64') : content.toString('utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
        });
        treeItems.push({
          path: f,
          mode: (fs.statSync(f).mode & 0o111) ? '100755' : '100644',
          type: 'blob',
          sha: blob.data.sha,
        });
        success = true;
      } catch (e: any) {
        if (attempt < 2) {
          const wait = (attempt + 1) * 10000;
          console.log(`  Rate limited: ${f}, waiting ${wait/1000}s...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.log(`  FAILED: ${f}`);
          failed++;
        }
      }
    }
    
    if ((i + 1) % 20 === 0) {
      console.log(`  Progress: ${i + 1}/${localFiles.length} (${treeItems.length} OK, ${failed} failed)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log(`\nUpload complete: ${treeItems.length} OK, ${failed} failed out of ${localFiles.length}`);
  
  if (failed > 0) {
    console.log("WARNING: Some files failed. Tree may be incomplete.");
  }

  // Create tree (no base_tree - fresh complete tree)
  console.log(`\nCreating tree with ${treeItems.length} items...`);
  const tree = await octokit.git.createTree({ owner, repo, tree: treeItems });
  console.log(`Tree: ${tree.data.sha}`);

  // Create commit
  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, IBM, PMGTH`,
    tree: tree.data.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  // Update ref
  await octokit.git.updateRef({
    owner, repo, ref: 'heads/main',
    sha: commit.data.sha, force: true,
  });
  console.log("Main branch updated!");

  // Trigger builds
  console.log("\n=== TRIGGERING BUILDS ===");
  await new Promise(r => setTimeout(r, 3000));
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered for T Ride & T Driver!");
  
  await new Promise(r => setTimeout(r, 8000));
  const runs = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: "build-android.yml", per_page: 5 });
  console.log("\nWorkflow runs:");
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
  }
  
  const rl = await octokit.rateLimit.get();
  console.log(`\nAPI: ${rl.data.rate.remaining}/${rl.data.rate.limit}`);
  console.log("\nALL DONE!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
