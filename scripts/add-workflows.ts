import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('GitHub not connected');
  const data = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json());
  return data.items?.[0]?.settings?.access_token || data.items?.[0]?.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const owner = 'HorseChain';
  const repo = 'travony';
  
  const files = [
    { path: '.github/workflows/code-scanning.yml', local: '.github/workflows/code-scanning.yml' },
    { path: '.github/workflows/release-notes.yml', local: '.github/workflows/release-notes.yml' }
  ];
  
  for (const file of files) {
    const content = fs.readFileSync(file.local, 'utf8');
    const contentBase64 = Buffer.from(content).toString('base64');
    
    try {
      // Try to get existing file SHA
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
        sha = (data as any).sha;
      } catch {}
      
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: file.path,
        message: `Add ${file.path.split('/').pop()}`,
        content: contentBase64,
        sha
      });
      console.log(`✓ Created ${file.path}`);
    } catch (e: any) {
      // Check if it's a branch protection issue
      if (e.status === 404) {
        console.log(`Note: Need to push via Git instead of API for ${file.path}`);
      } else {
        console.log(`Error for ${file.path}: ${e.status} - ${e.message}`);
      }
    }
  }
  
  console.log('\nThe workflow files are created locally. They will be synced when code is next pushed to GitHub.');
  console.log('\nTo test the release notes generator, create a tag: git tag v2.0.3 && git push origin v2.0.3');
}

main().catch(e => console.error('Error:', e.message));
