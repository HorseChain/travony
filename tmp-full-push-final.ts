const { Octokit } = require('@octokit/rest');
const fs = require('fs');

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) throw new Error("No replit token");
  const res = await fetch("https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=github", { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } });
  const data = await res.json() as any;
  const conn = data.items?.[0];
  return conn?.settings?.access_token || conn?.settings?.oauth?.credentials?.access_token || (() => { throw new Error("No token") })();
}

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Repo: ${owner}/${repo}`);

  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const remoteHead = ref.data.object.sha;

  // Get ALL local files  
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  
  // Exclude: secret files, temp scripts, credentials, and sensitive attached_assets
  const allFiles = allFilesRaw.trim().split('\n').filter((f: string) => {
    if (!f || !fs.existsSync(f)) return false;
    if (f.includes('replit-publisher')) return false;
    if (f.startsWith('tmp-')) return false;
    if (f.startsWith('credentials/')) return false;
    // Exclude attached_assets with credentials/sensitive content
    if (f.includes('keystore-credentials')) return false;
    if (f.endsWith('.der')) return false;
    if (f.endsWith('.jks.b64')) return false;
    return true;
  });
  
  console.log(`Total files: ${allFiles.length}`);

  // Upload all blobs
  const allBlobs: Array<{path: string, sha: string}> = [];
  
  for (let i = 0; i < allFiles.length; i++) {
    const f = allFiles[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const content = fs.readFileSync(f);
        const isBinary = content.includes(0x00);
        const blob = await octokit.git.createBlob({
          owner, repo,
          content: isBinary ? content.toString('base64') : content.toString('utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
        });
        allBlobs.push({ path: f, sha: blob.data.sha });
        break;
      } catch (e: any) {
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt+1) * 10000));
        else console.log(`SKIP: ${f}`);
      }
    }
    if ((i+1) % 20 === 0) {
      console.log(`Upload: ${i+1}/${allFiles.length}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`Uploaded: ${allBlobs.length}/${allFiles.length}`);

  // Try creating tree, and if it fails, binary search for problematic file
  async function tryCreateTree(items: any[]): Promise<any> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tree: items }),
    });
    if (res.status === 201) return await res.json();
    return null;
  }
  
  let treeItems = allBlobs.map(b => ({
    path: b.path, mode: '100644', type: 'blob', sha: b.sha,
  }));
  
  console.log(`\nTrying tree with ${treeItems.length} items...`);
  let result = await tryCreateTree(treeItems);
  
  if (!result) {
    console.log("Failed! Finding problematic files via binary search...");
    
    // Binary search to find problematic files
    const problematicFiles: string[] = [];
    
    // Test first half vs second half
    const mid = Math.floor(treeItems.length / 2);
    const firstHalf = treeItems.slice(0, mid);
    const secondHalf = treeItems.slice(mid);
    
    const r1 = await tryCreateTree(firstHalf);
    const r2 = await tryCreateTree(secondHalf);
    console.log(`First half (${firstHalf.length}): ${r1 ? 'OK' : 'FAIL'}`);
    console.log(`Second half (${secondHalf.length}): ${r2 ? 'OK' : 'FAIL'}`);
    
    // Find and remove problematic files from the failing half
    async function findBad(items: any[]): Promise<string[]> {
      if (items.length <= 1) {
        const test = await tryCreateTree(items);
        return test ? [] : [items[0].path];
      }
      
      const test = await tryCreateTree(items);
      if (test) return []; // All good
      
      const m = Math.floor(items.length / 2);
      const badLeft = await findBad(items.slice(0, m));
      const badRight = await findBad(items.slice(m));
      return [...badLeft, ...badRight];
    }
    
    const failingHalf = !r1 ? firstHalf : secondHalf;
    console.log(`\nSearching for bad files in failing half (${failingHalf.length} items)...`);
    
    // Narrow down in quarters
    const q = Math.floor(failingHalf.length / 4);
    for (let i = 0; i < 4; i++) {
      const quarter = failingHalf.slice(i * q, (i + 1) * q);
      const qr = await tryCreateTree(quarter);
      if (!qr) {
        console.log(`Quarter ${i+1}: FAIL (${quarter.length} items: ${quarter[0].path} ... ${quarter[quarter.length-1].path})`);
        // Further narrow
        for (let j = 0; j < quarter.length; j += 5) {
          const chunk = quarter.slice(j, j + 5);
          const cr = await tryCreateTree(chunk);
          if (!cr) {
            // Test each individually
            for (const item of chunk) {
              const ir = await tryCreateTree([item]);
              if (!ir) {
                console.log(`  BAD FILE: ${item.path}`);
                problematicFiles.push(item.path);
              }
            }
          }
        }
      } else {
        console.log(`Quarter ${i+1}: OK`);
      }
    }
    
    console.log(`\nProblematic files found: ${problematicFiles.length}`);
    problematicFiles.forEach(f => console.log(`  ${f}`));
    
    // Remove problematic files and retry
    treeItems = treeItems.filter(t => !problematicFiles.includes(t.path));
    console.log(`\nRetrying with ${treeItems.length} items...`);
    result = await tryCreateTree(treeItems);
    
    if (!result) {
      // Still failing, try removing files in batches
      console.log("Still failing. Testing all quarters independently...");
      const goodItems: any[] = [];
      const batchSize = 30;
      for (let i = 0; i < treeItems.length; i += batchSize) {
        const batch = treeItems.slice(i, i + batchSize);
        const br = await tryCreateTree(batch);
        if (br) {
          goodItems.push(...batch);
        } else {
          console.log(`Batch ${Math.floor(i/batchSize) + 1} FAILED, testing individually...`);
          for (const item of batch) {
            const ir = await tryCreateTree([item]);
            if (ir) {
              goodItems.push(item);
            } else {
              console.log(`  BAD: ${item.path}`);
            }
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`\nGood items: ${goodItems.length}, trying tree...`);
      result = await tryCreateTree(goodItems);
      treeItems = goodItems;
    }
  }
  
  if (!result) {
    console.log("FATAL: Could not create tree even after removing bad files!");
    process.exit(1);
  }
  
  console.log(`Tree: ${result.sha}`);

  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 (versionCode 39) Build #27 - All features: dark mode, Ghost Mode, Ride Truth Engine, Help & Support, IBM, PMGTH`,
    tree: result.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha, force: true });
  console.log("Branch updated!");

  console.log("\nTriggering builds...");
  await new Promise(r => setTimeout(r, 3000));
  await octokit.actions.createWorkflowDispatch({
    owner, repo, workflow_id: "build-android.yml", ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("BUILDS TRIGGERED!");
  
  await new Promise(r => setTimeout(r, 8000));
  const runs = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: "build-android.yml", per_page: 3 });
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
  }
  console.log("\nDONE!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
