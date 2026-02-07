import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('GitHub not connected');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function main() {
  const variant = process.argv[2] || 'both';
  
  try {
    const accessToken = await getAccessToken();
    const octokit = new Octokit({ auth: accessToken });

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 10
    });
    
    const travonyRepo = repos.find(r => r.name.toLowerCase().includes('travony') || r.name.toLowerCase().includes('t-ride'));
    
    if (!travonyRepo) {
      throw new Error('Could not find Travony repository');
    }

    const [owner, repo] = travonyRepo.full_name.split('/');
    console.log(`Repository: ${travonyRepo.full_name}`);
    console.log(`Triggering build for: ${variant}`);

    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'build-android.yml',
      ref: 'main',
      inputs: {
        app_variant: variant,
        publish_track: 'none'
      }
    });

    console.log(`\nBuild workflow triggered successfully!`);
    console.log(`Check progress at: https://github.com/${owner}/${repo}/actions`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
