import { Octokit } from '@octokit/rest'

let connectionSettings: any;

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
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  );
  const data = await res.json();
  const conn = data.items?.[0];
  const token = conn?.settings?.access_token || conn?.settings?.oauth?.credentials?.access_token;
  if (!token) throw new Error("GitHub not connected");
  return token;
}

async function getOctokit() {
  const token = await getAccessToken();
  return { octokit: new Octokit({ auth: token }), token };
}

function runCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { exec } = require("child_process");
    exec(cmd, { cwd: "/home/runner/workspace", maxBuffer: 10 * 1024 * 1024 }, (err: any, stdout: string, stderr: string) => {
      if (err && !stdout && !stderr) reject(err);
      else resolve((stdout || "") + (stderr || ""));
    });
  });
}

async function main() {
  const { octokit, token } = await getOctokit();

  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  const repos = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
  const travonyRepo = repos.data.find(
    (r: any) =>
      r.name.toLowerCase().includes("travony") ||
      r.name.toLowerCase().includes("t-ride") ||
      r.name.toLowerCase().includes("tride")
  );

  if (!travonyRepo) {
    console.log("Available repos:");
    repos.data.forEach((r: any) => console.log(`  - ${r.full_name}`));
    throw new Error("Could not find Travony repo.");
  }

  const owner = travonyRepo.owner.login;
  const repo = travonyRepo.name;
  console.log(`Found repo: ${owner}/${repo}`);

  console.log("\nPushing to GitHub...");
  const pushUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  const pushResult = await runCommand(`git push "${pushUrl}" main --force 2>&1`);
  console.log(pushResult);

  console.log("Triggering Build Android AAB workflow for BOTH apps...");
  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: "build-android.yml",
    ref: "main",
    inputs: {
      app_variant: "both",
      publish_track: "none",
    },
  });

  console.log("Build triggered successfully for both T Ride and T Driver!");

  await new Promise((r) => setTimeout(r, 5000));

  const runs = await octokit.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: "build-android.yml",
    per_page: 3,
  });

  if (runs.data.workflow_runs.length > 0) {
    const run = runs.data.workflow_runs[0];
    console.log(`\nWorkflow Run: ${run.html_url}`);
    console.log(`Status: ${run.status}`);
    console.log(`Run ID: ${run.id}`);
    console.log(`Created: ${run.created_at}`);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
