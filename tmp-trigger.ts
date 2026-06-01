const { Octokit } = require('@octokit/rest');

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

  // Check what the latest commit is
  const ref = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  console.log(`Current HEAD: ${ref.data.object.sha}`);

  // Check recent workflow runs
  const runs = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: "build-android.yml", per_page: 5 });
  console.log("\nRecent workflow runs:");
  for (const r of runs.data.workflow_runs) {
    console.log(`  Run #${r.run_number} | ${r.status} | ${r.conclusion || 'running'} | ${r.html_url}`);
  }

  // Check if a build was already triggered
  const latestRun = runs.data.workflow_runs[0];
  if (latestRun && latestRun.status === 'queued' || latestRun?.status === 'in_progress') {
    console.log("\nBuild already running/queued!");
  } else {
    // Trigger new build
    console.log("\nTriggering new builds...");
    await octokit.actions.createWorkflowDispatch({
      owner, repo, workflow_id: "build-android.yml", ref: "main",
      inputs: { app_variant: "both", publish_track: "none" },
    });
    console.log("Builds triggered!");
    
    await new Promise(r => setTimeout(r, 8000));
    
    const newRuns = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: "build-android.yml", per_page: 3 });
    console.log("\nNew workflow runs:");
    for (const r of newRuns.data.workflow_runs.slice(0, 3)) {
      console.log(`  Run #${r.run_number} | ${r.status} | ${r.html_url}`);
    }
  }
  
  // Verify the code has our latest changes
  console.log("\nVerifying key files on GitHub...");
  try {
    const helpScreen = await octokit.repos.getContent({ owner, repo, path: 'client/screens/HelpScreen.tsx' });
    const content = Buffer.from(helpScreen.data.content, 'base64').toString('utf-8');
    const hasNewEmail = content.includes('support@travony.com');
    const hasNoPhone = !content.includes('+1-800') && !content.includes('+1 (800)');
    console.log(`  HelpScreen: email updated: ${hasNewEmail}, no phone: ${hasNoPhone}`);
  } catch (e: any) {
    console.log(`  HelpScreen: ${e.message}`);
  }
  
  try {
    const ghostMode = await octokit.repos.getContent({ owner, repo, path: 'client/screens/GhostModeScreen.tsx' });
    const content = Buffer.from(ghostMode.data.content, 'base64').toString('utf-8');
    const hasInfoCard = content.includes('How Ghost Mode Works');
    console.log(`  GhostModeScreen: info card: ${hasInfoCard}`);
  } catch (e: any) {
    console.log(`  GhostModeScreen: ${e.message}`);
  }

  try {
    const support = await octokit.repos.getContent({ owner, repo, path: 'server/templates/support.html' });
    const content = Buffer.from(support.data.content, 'base64').toString('utf-8');
    const hasTruthFaq = content.includes('Ride Truth Engine');
    const hasGhostFaq = content.includes('Ghost Mode');
    console.log(`  support.html: Truth FAQ: ${hasTruthFaq}, Ghost FAQ: ${hasGhostFaq}`);
  } catch (e: any) {
    console.log(`  support.html: ${e.message}`);
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
