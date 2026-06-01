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

  // Upload 50 real files and try creating tree
  const { exec } = require('child_process');
  const allFilesRaw: string = await new Promise((resolve) => {
    exec('git ls-files client/ shared/ server/index.ts server/routes.ts', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
  });
  
  const files = allFilesRaw.trim().split('\n').filter(Boolean).slice(0, 50);
  console.log(`Testing with ${files.length} real files...`);
  
  const treeItems: any[] = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f);
    const isBinary = content.includes(0x00);
    const blob = await octokit.git.createBlob({
      owner, repo,
      content: isBinary ? content.toString('base64') : content.toString('utf-8'),
      encoding: isBinary ? 'base64' : 'utf-8',
    });
    treeItems.push({ path: f, mode: '100644', type: 'blob', sha: blob.data.sha });
  }
  console.log(`Uploaded ${treeItems.length} blobs`);
  
  // Try creating tree using raw fetch to see full error
  console.log("\nCreating tree with raw fetch...");
  const rawRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ tree: treeItems }),
  });
  
  const rawText = await rawRes.text();
  console.log(`Status: ${rawRes.status}`);
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(rawRes.headers))}`);
  console.log(`Body: ${rawText.substring(0, 2000)}`);
  
  if (rawRes.status === 201) {
    console.log("\n50 files: SUCCESS!");
    
    // Now try 100
    console.log("\nTrying 100 files...");
    const moreFiles: string = await new Promise((resolve) => {
      exec('git ls-files client/ shared/ server/', { cwd: '/home/runner/workspace', maxBuffer: 50*1024*1024 }, (_: any, s: string) => resolve(s || ""));
    });
    const files100 = moreFiles.trim().split('\n').filter(Boolean).slice(0, 100);
    
    const items100: any[] = [];
    for (const f of files100) {
      if (!fs.existsSync(f)) continue;
      // Check if already uploaded
      const existing = treeItems.find(t => t.path === f);
      if (existing) {
        items100.push(existing);
        continue;
      }
      const content = fs.readFileSync(f);
      const isBinary = content.includes(0x00);
      const blob = await octokit.git.createBlob({
        owner, repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });
      items100.push({ path: f, mode: '100644', type: 'blob', sha: blob.data.sha });
    }
    
    const res100 = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tree: items100 }),
    });
    console.log(`100 files status: ${res100.status}`);
    if (res100.status !== 201) {
      const body = await res100.text();
      console.log(`Error: ${body.substring(0, 500)}`);
    } else {
      console.log("100 files: SUCCESS!");
    }
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
