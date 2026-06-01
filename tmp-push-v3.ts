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
  if (!travonyRepo) throw new Error("Repo not found");
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  // First: verify what the actual remote tree looks like
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;
  console.log(`Remote HEAD: ${remoteHead}`);
  
  const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
  const remoteTreeSha = remoteCommit.data.tree.sha;
  console.log(`Remote tree: ${remoteTreeSha}`);
  
  // Check if tree is truncated
  const remoteTree = await octokit.git.getTree({ owner, repo, tree_sha: remoteTreeSha, recursive: 'true' });
  console.log(`Remote tree has ${remoteTree.data.tree.length} items, truncated: ${remoteTree.data.truncated}`);
  
  if (remoteTree.data.tree.length < 10) {
    console.log("Remote tree is nearly empty (test commit damage). Need full rebuild.");
    console.log("Remote files:");
    remoteTree.data.tree.forEach((t: any) => console.log(`  ${t.path} (${t.type})`));
  }

  // Get local files
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  
  const excludePatterns = ['replit-publisher-084dbaff4147', 'tmp-push', 'tmp-build', 'tmp-full', 'tmp-smart', 'tmp-check', 'tmp-unblock', 'tmp-final'];
  const localFiles = allFilesRaw.trim().split('\n').filter((f: string) => f && !excludePatterns.some(p => f.includes(p)) && fs.existsSync(f));
  console.log(`\nLocal files to include: ${localFiles.length}`);

  // Build remote SHA map
  const remoteFileShas = new Map<string, string>();
  for (const item of remoteTree.data.tree) {
    if (item.type === 'blob') remoteFileShas.set(item.path!, item.sha!);
  }

  // Compute which files need new blobs vs which can reuse remote SHAs
  const needUpload: string[] = [];
  const reuseRemote: Array<{path: string, sha: string, mode: string}> = [];
  
  for (const f of localFiles) {
    const content = fs.readFileSync(f);
    const localSha = gitBlobHash(content);
    const remoteSha = remoteFileShas.get(f);
    
    if (remoteSha && localSha === remoteSha) {
      // Find mode from remote tree
      const remoteItem = remoteTree.data.tree.find((t: any) => t.path === f);
      reuseRemote.push({ path: f, sha: remoteSha, mode: remoteItem?.mode || '100644' });
    } else {
      needUpload.push(f);
    }
  }
  
  console.log(`Reuse remote blobs: ${reuseRemote.length}`);
  console.log(`Need upload: ${needUpload.length}`);
  
  // Upload needed blobs sequentially with delays
  console.log("\nUploading blobs...");
  const uploadedBlobs: Array<{path: string, sha: string, mode: string}> = [];
  
  for (let i = 0; i < needUpload.length; i++) {
    const f = needUpload[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const content = fs.readFileSync(f);
        const isBinary = content.includes(0x00);
        const blob = await octokit.git.createBlob({
          owner, repo,
          content: isBinary ? content.toString('base64') : content.toString('utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
        });
        uploadedBlobs.push({
          path: f,
          sha: blob.data.sha,
          mode: (fs.statSync(f).mode & 0o111) ? '100755' : '100644',
        });
        break;
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 10000));
        } else {
          console.log(`  SKIP: ${f} - ${e.message}`);
        }
      }
    }
    
    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${needUpload.length} uploaded`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.log(`  ${needUpload.length}/${needUpload.length} done`);
  console.log(`Successfully uploaded: ${uploadedBlobs.length}/${needUpload.length}`);

  // Build FULL tree (no base_tree) - combine reused + uploaded
  const allTreeItems = [
    ...reuseRemote.map(b => ({ path: b.path, mode: b.mode as '100644', type: 'blob' as const, sha: b.sha })),
    ...uploadedBlobs.map(b => ({ path: b.path, mode: b.mode as '100644', type: 'blob' as const, sha: b.sha })),
  ];
  
  console.log(`\nCreating FULL tree with ${allTreeItems.length} items (NO base_tree)...`);
  
  const tree = await octokit.git.createTree({
    owner, repo,
    tree: allTreeItems,
  });
  console.log(`Tree: ${tree.data.sha}`);

  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, IBM, PMGTH, legal updates`,
    tree: tree.data.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  await octokit.git.updateRef({
    owner, repo, ref: 'heads/main',
    sha: commit.data.sha, force: true,
  });
  console.log("Main branch updated successfully!");

  // TRIGGER BUILDS
  console.log("\n=== TRIGGERING BUILDS FOR BOTH APPS ===");
  await new Promise(r => setTimeout(r, 3000));
  
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered for T Ride and T Driver!");
  
  await new Promise(r => setTimeout(r, 8000));
  
  const runs = await octokit.actions.listWorkflowRuns({
    owner, repo, workflow_id: "build-android.yml", per_page: 5,
  });
  console.log("\nLatest workflow runs:");
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
  }
  
  const rl = await octokit.rateLimit.get();
  console.log(`API: ${rl.data.rate.remaining}/${rl.data.rate.limit}`);
  console.log("\nALL DONE!");
}

main().catch(e => { console.error("FATAL:", e.message, e.status); process.exit(1); });
