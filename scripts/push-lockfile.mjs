import * as fs from 'fs';

async function main() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY : null;
  
  const connResponse = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );
  const connData = await connResponse.json();
  const token = connData.items?.[0]?.settings?.access_token;
  
  const content = fs.readFileSync('/home/runner/workspace/package-lock.json', 'utf-8');
  console.log('package-lock.json size:', (content.length / 1024).toFixed(0), 'KB');
  
  const checkResp = await fetch('https://api.github.com/repos/HorseChain/travony/contents/package-lock.json', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  const existingFile = checkResp.ok ? await checkResp.json() : null;
  
  const body = {
    message: 'Add package-lock.json for npm ci',
    content: Buffer.from(content).toString('base64'),
    branch: 'main'
  };
  if (existingFile?.sha) body.sha = existingFile.sha;
  
  console.log('Uploading package-lock.json...');
  const response = await fetch('https://api.github.com/repos/HorseChain/travony/contents/package-lock.json', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  console.log('Status:', response.status);
  if (response.ok) {
    console.log('Success! package-lock.json pushed.');
  } else {
    const err = await response.json();
    console.log('Error:', err.message);
  }
}

main().catch(e => console.error('Error:', e.message));
