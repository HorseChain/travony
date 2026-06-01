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
  console.log(`Remote HEAD: ${remoteHead.substring(0,8)}`);

  // Get local files - ONLY build-essential ones
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  
  // Only include directories needed for Android build
  const includePatterns = [
    'client/', 'server/', 'shared/', 'assets/',
    '.github/', 'scripts/publish-to-play-store.js',
    'scripts/build',
  ];
  const includeRootFiles = [
    'package.json', 'package-lock.json', 'tsconfig.json', 
    'babel.config.js', 'metro.config.js', 'app.json',
    'app.rider.json', 'app.driver.json',
    '.gitignore', '.easignore', 'drizzle.config.ts',
    'eslint.config.js', 'replit.md',
  ];
  
  // Exclude sensitive and unnecessary files
  const excludePatterns = [
    'replit-publisher', 'tmp-', 'credentials/',
    'attached_assets/', 'static-build/', 'docs/',
    'check-play-status', 'server/public/store-assets/',
    'server/public/icons/',
  ];
  
  const buildFiles = allFilesRaw.trim().split('\n').filter((f: string) => {
    if (!f || !fs.existsSync(f)) return false;
    if (excludePatterns.some(p => f.includes(p))) return false;
    if (includeRootFiles.includes(f)) return true;
    if (includePatterns.some(p => f.startsWith(p))) return true;
    return false;
  });
  
  console.log(`Build-essential files: ${buildFiles.length}`);

  // Upload all blobs
  const treeItems: any[] = [];
  let failed = 0;
  
  for (let i = 0; i < buildFiles.length; i++) {
    const f = buildFiles[i];
    for (let attempt = 0; attempt < 3; attempt++) {
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
        break;
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 10000));
        } else {
          console.log(`  FAILED: ${f} - ${e.message}`);
          failed++;
        }
      }
    }
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${buildFiles.length}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log(`Uploaded: ${treeItems.length} OK, ${failed} failed`);

  // Create tree
  console.log(`\nCreating tree...`);
  const tree = await octokit.git.createTree({ owner, repo, tree: treeItems });
  console.log(`Tree: ${tree.data.sha}`);

  const commit = await octokit.git.createCommit({
    owner, repo,
    message: `v4.0.0 (versionCode 39) Build #27 - All features`,
    tree: tree.data.sha,
    parents: [remoteHead],
  });
  console.log(`Commit: ${commit.data.sha}`);

  await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha, force: true });
  console.log("Branch updated!");

  console.log("\nTriggering builds...");
  await new Promise(r => setTimeout(r, 3000));
  await octokit.actions.createWorkflowDispatch({
    owner, repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: { app_variant: "both", publish_track: "none" },
  });
  console.log("Builds triggered!");
  
  await new Promise(r => setTimeout(r, 8000));
  const runs = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: "build-android.yml", per_page: 3 });
  for (const r of runs.data.workflow_runs.slice(0, 3)) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
  }
  
  console.log("\nDONE!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
