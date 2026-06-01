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

  // Upload 5 real files as blobs
  const testFiles = ['package.json', 'tsconfig.json', 'app.json', 'babel.config.js', '.gitignore'];
  const treeItems: any[] = [];
  
  for (const f of testFiles) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf-8');
    const blob = await octokit.git.createBlob({ owner, repo, content, encoding: 'utf-8' });
    console.log(`Blob for ${f}: ${blob.data.sha}`);
    treeItems.push({ path: f, mode: '100644', type: 'blob', sha: blob.data.sha });
  }
  
  // Test 1: Create tree without base_tree
  console.log("\nTest 1: Create tree with 5 items (no base_tree)...");
  try {
    const tree1 = await octokit.git.createTree({ owner, repo, tree: treeItems });
    console.log(`OK: ${tree1.data.sha}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.status} ${e.message}`);
    // Try with raw fetch to see error details
    const rawRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ tree: treeItems }),
    });
    const rawData = await rawRes.json();
    console.log(`Raw response (${rawRes.status}): ${JSON.stringify(rawData).substring(0, 500)}`);
  }

  // Test 2: Create tree with nested path
  console.log("\nTest 2: Create tree with nested paths...");
  const nestedItems = [
    { path: 'client/App.tsx', mode: '100644', type: 'blob', sha: treeItems[0].sha },
    { path: 'server/index.ts', mode: '100644', type: 'blob', sha: treeItems[1].sha },
  ];
  try {
    const tree2 = await octokit.git.createTree({ owner, repo, tree: nestedItems });
    console.log(`OK: ${tree2.data.sha}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.status} ${e.message}`);
    const rawRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tree: nestedItems }),
    });
    const rawData = await rawRes.json();
    console.log(`Raw response (${rawRes.status}): ${JSON.stringify(rawData).substring(0, 500)}`);
  }

  // Test 3: 50 items
  console.log("\nTest 3: 50 items...");
  const manyItems: any[] = [];
  for (let i = 0; i < 50; i++) {
    manyItems.push({ path: `test/file${i}.txt`, mode: '100644', type: 'blob', sha: treeItems[0].sha });
  }
  try {
    const tree3 = await octokit.git.createTree({ owner, repo, tree: manyItems });
    console.log(`OK: ${tree3.data.sha}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.status} ${e.message}`);
  }

  // Test 4: 200 items
  console.log("\nTest 4: 200 items...");
  const manyItems2: any[] = [];
  for (let i = 0; i < 200; i++) {
    manyItems2.push({ path: `test/file${i}.txt`, mode: '100644', type: 'blob', sha: treeItems[0].sha });
  }
  try {
    const tree4 = await octokit.git.createTree({ owner, repo, tree: manyItems2 });
    console.log(`OK: ${tree4.data.sha}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.status} ${e.message}`);
  }

  // Test 5: Real files - upload and create tree with real client files
  console.log("\nTest 5: 10 real client files...");
  const { exec } = require('child_process');
  const allFiles: string = await new Promise((resolve) => {
    exec('git ls-files client/', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  const clientFiles = allFiles.trim().split('\n').filter(Boolean).slice(0, 10);
  const realItems: any[] = [];
  for (const f of clientFiles) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f);
    const isBinary = content.includes(0x00);
    const blob = await octokit.git.createBlob({
      owner, repo,
      content: isBinary ? content.toString('base64') : content.toString('utf-8'),
      encoding: isBinary ? 'base64' : 'utf-8',
    });
    realItems.push({ path: f, mode: '100644', type: 'blob', sha: blob.data.sha });
    console.log(`  ${f}: ${blob.data.sha}`);
  }
  
  try {
    const tree5 = await octokit.git.createTree({ owner, repo, tree: realItems });
    console.log(`OK: ${tree5.data.sha}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.status} ${e.message}`);
    // Try raw to see error
    const rawRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tree: realItems }),
    });
    const rawData = await rawRes.json();
    console.log(`Raw (${rawRes.status}): ${JSON.stringify(rawData).substring(0, 1000)}`);
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
