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

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  if (!travonyRepo) throw new Error("Repo not found");
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  // Get remote state
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;
  const remoteCommit = await octokit.git.getCommit({ owner, repo, commit_sha: remoteHead });
  const remoteTreeSha = remoteCommit.data.tree.sha;
  
  // Get remote file list
  const remoteTree = await octokit.git.getTree({ owner, repo, tree_sha: remoteTreeSha, recursive: 'true' });
  const remoteFileShas = new Map<string, string>();
  for (const item of remoteTree.data.tree) {
    if (item.type === 'blob') remoteFileShas.set(item.path!, item.sha!);
  }
  console.log(`Remote: ${remoteFileShas.size} files, HEAD: ${remoteHead.substring(0, 8)}`);

  // Get local files
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50 * 1024 * 1024 }, 
      (_: any, stdout: string) => resolve(stdout || ""));
  });
  
  const excludePatterns = ['replit-publisher-084dbaff4147', 'tmp-push', 'tmp-build', 'tmp-full', 'tmp-smart', 'tmp-check', 'tmp-unblock', 'tmp-final'];
  const localFiles = allFilesRaw.trim().split('\n')
    .filter(f => f && !excludePatterns.some(p => f.includes(p)));
  
  // Find ONLY changed/new files
  const changedFiles: string[] = [];
  for (const f of localFiles) {
    if (!fs.existsSync(f)) continue;
    try {
      const content = fs.readFileSync(f);
      const localSha = gitBlobHash(content);
      const remoteSha = remoteFileShas.get(f);
      if (!remoteSha || localSha !== remoteSha) {
        changedFiles.push(f);
      }
    } catch { /* skip */ }
  }
  
  console.log(`Changed/New: ${changedFiles.length}`);
  changedFiles.forEach(f => console.log(`  ${f}`));

  if (changedFiles.length === 0) {
    console.log("No changes to push!");
  } else {
    // Upload blobs ONE AT A TIME to avoid rate limiting issues
    const successBlobs: Array<{path: string, sha: string, mode: string}> = [];
    
    for (let i = 0; i < changedFiles.length; i++) {
      const f = changedFiles[i];
      try {
        const content = fs.readFileSync(f);
        const isBinary = content.includes(0x00);
        
        const blob = await octokit.git.createBlob({
          owner, repo,
          content: isBinary ? content.toString('base64') : content.toString('utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
        });
        
        // Verify the blob exists
        try {
          await octokit.git.getBlob({ owner, repo, file_sha: blob.data.sha });
        } catch {
          console.log(`  WARNING: Blob verification failed for ${f}, retrying...`);
          await new Promise(r => setTimeout(r, 3000));
          const blob2 = await octokit.git.createBlob({
            owner, repo,
            content: isBinary ? content.toString('base64') : content.toString('utf-8'),
            encoding: isBinary ? 'base64' : 'utf-8',
          });
          await octokit.git.getBlob({ owner, repo, file_sha: blob2.data.sha });
          successBlobs.push({
            path: f,
            sha: blob2.data.sha,
            mode: (fs.statSync(f).mode & 0o111) ? '100755' : '100644',
          });
          console.log(`  [${i+1}/${changedFiles.length}] ${f} (retry OK)`);
          continue;
        }
        
        successBlobs.push({
          path: f,
          sha: blob.data.sha,
          mode: (fs.statSync(f).mode & 0o111) ? '100755' : '100644',
        });
        console.log(`  [${i+1}/${changedFiles.length}] ${f} OK`);
        
        // Gentle rate limiting
        if ((i + 1) % 5 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e: any) {
        console.log(`  [${i+1}/${changedFiles.length}] FAILED: ${f} - ${e.message}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    
    console.log(`\nSuccessfully uploaded: ${successBlobs.length}/${changedFiles.length}`);
    
    if (successBlobs.length === 0) {
      throw new Error("No blobs uploaded successfully!");
    }
    
    // Create tree items (no deletions to avoid null SHA issues)
    const treeItems = successBlobs.map(b => ({
      path: b.path,
      mode: b.mode as '100644',
      type: 'blob' as const,
      sha: b.sha,
    }));
    
    console.log(`Creating tree (${treeItems.length} items)...`);
    
    // Try with small batch first to test
    if (treeItems.length > 50) {
      // Split into chunks of 50
      let currentTreeSha = remoteTreeSha;
      const chunkSize = 50;
      
      for (let i = 0; i < treeItems.length; i += chunkSize) {
        const chunk = treeItems.slice(i, i + chunkSize);
        console.log(`  Tree chunk ${Math.floor(i/chunkSize) + 1}: ${chunk.length} items...`);
        const tree = await octokit.git.createTree({
          owner, repo,
          base_tree: currentTreeSha,
          tree: chunk,
        });
        currentTreeSha = tree.data.sha;
        console.log(`  Tree chunk SHA: ${currentTreeSha}`);
      }
      
      // Create commit
      const commit = await octokit.git.createCommit({
        owner, repo,
        message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, IBM, PMGTH`,
        tree: currentTreeSha,
        parents: [remoteHead],
      });
      console.log(`Commit: ${commit.data.sha}`);
      
      await octokit.git.updateRef({
        owner, repo, ref: 'heads/main',
        sha: commit.data.sha, force: true,
      });
      console.log("Branch updated!");
    } else {
      const tree = await octokit.git.createTree({
        owner, repo,
        base_tree: remoteTreeSha,
        tree: treeItems,
      });
      console.log(`Tree: ${tree.data.sha}`);
      
      const commit = await octokit.git.createCommit({
        owner, repo,
        message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, IBM, PMGTH`,
        tree: tree.data.sha,
        parents: [remoteHead],
      });
      console.log(`Commit: ${commit.data.sha}`);
      
      await octokit.git.updateRef({
        owner, repo, ref: 'heads/main',
        sha: commit.data.sha, force: true,
      });
      console.log("Branch updated!");
    }
  }

  // TRIGGER BUILDS
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
    console.log(`  Run #${r.run_number} | Status: ${r.status} | ${r.html_url}`);
  }
  
  const rl = await octokit.rateLimit.get();
  console.log(`\nAPI calls remaining: ${rl.data.rate.remaining}/${rl.data.rate.limit}`);
  console.log("\nDONE!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
