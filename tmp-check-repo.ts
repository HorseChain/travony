const { Octokit } = require('@octokit/rest');

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

async function main() {
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = (repos.data as any[]).find((r: any) => r.name.toLowerCase().includes("travony"));
  if (!travonyRepo) throw new Error("Repo not found");
  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  
  console.log(`Repo: ${owner}/${repo}`);
  console.log(`Permissions: ${JSON.stringify(travonyRepo.permissions)}`);
  console.log(`Private: ${travonyRepo.private}`);
  console.log(`Default branch: ${travonyRepo.default_branch}`);
  
  // Check repo details
  const repoDetails = await octokit.repos.get({ owner, repo });
  console.log(`\nFork: ${repoDetails.data.fork}`);
  console.log(`Size: ${repoDetails.data.size} KB`);
  
  // Check branches
  const branches = await octokit.repos.listBranches({ owner, repo });
  console.log(`\nBranches:`);
  for (const b of branches.data) {
    console.log(`  ${b.name}: ${b.commit.sha} (protected: ${b.protected})`);
  }
  
  // Check branch protection rules
  try {
    const protection = await octokit.repos.getBranchProtection({ owner, repo, branch: 'main' });
    console.log(`\nBranch protection: ${JSON.stringify(protection.data, null, 2).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`\nBranch protection: ${e.status === 404 ? 'None' : e.message}`);
  }
  
  // Check rulesets (GitHub's newer protection)
  try {
    const rulesets = await octokit.request('GET /repos/{owner}/{repo}/rulesets', { owner, repo });
    console.log(`\nRulesets: ${JSON.stringify(rulesets.data, null, 2).substring(0, 1000)}`);
  } catch (e: any) {
    console.log(`\nRulesets: ${e.message}`);
  }

  // Test: can we create a simple blob?
  console.log("\nTest: Creating a test blob...");
  try {
    const blob = await octokit.git.createBlob({ owner, repo, content: "test", encoding: "utf-8" });
    console.log(`Blob OK: ${blob.data.sha}`);
    
    // Test: can we create a tree with just this blob?
    console.log("Test: Creating a simple tree...");
    const tree = await octokit.git.createTree({
      owner, repo,
      tree: [{ path: "test.txt", mode: "100644", type: "blob", sha: blob.data.sha }],
    });
    console.log(`Tree OK: ${tree.data.sha}`);
    
    // Test: can we create a tree with base_tree?
    const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
    const headCommit = await octokit.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
    console.log(`Remote tree SHA: ${headCommit.data.tree.sha}`);
    
    console.log("Test: Creating tree with base_tree...");
    const tree2 = await octokit.git.createTree({
      owner, repo,
      base_tree: headCommit.data.tree.sha,
      tree: [{ path: "test.txt", mode: "100644", type: "blob", sha: blob.data.sha }],
    });
    console.log(`Tree with base OK: ${tree2.data.sha}`);
    
    // Test commit
    console.log("Test: Creating commit...");
    const commit = await octokit.git.createCommit({
      owner, repo,
      message: "Test commit - will be overwritten",
      tree: tree2.data.sha,
      parents: [ref.data.object.sha],
    });
    console.log(`Commit OK: ${commit.data.sha}`);
    
    // Can we update ref?
    console.log("Test: Updating ref...");
    await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha, force: true });
    console.log("Ref update OK!");
    
  } catch (e: any) {
    console.log(`Test failed: ${e.status} ${e.message}`);
  }
  
  // Check rate limit
  const rateLimit = await octokit.rateLimit.get();
  console.log(`\nRate limit: ${rateLimit.data.rate.remaining}/${rateLimit.data.rate.limit} (resets: ${new Date(rateLimit.data.rate.reset * 1000).toISOString()})`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
