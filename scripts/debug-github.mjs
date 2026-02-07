async function main() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY : null;
  
  const connResponse = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );
  const connData = await connResponse.json();
  const token = connData.items?.[0]?.settings?.access_token;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  
  // Check token scopes
  const userResp = await fetch('https://api.github.com/user', { headers });
  console.log('User API Status:', userResp.status);
  console.log('Scopes:', userResp.headers.get('x-oauth-scopes'));
  
  // Try to create a simple tree with a workflow file
  const refResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/ref/heads/main', { headers });
  const refData = await refResp.json();
  
  const commitResp = await fetch(`https://api.github.com/repos/HorseChain/travony/git/commits/${refData.object.sha}`, { headers });
  const commitData = await commitResp.json();
  
  // Create a simple blob
  const blobResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/blobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'test', encoding: 'utf-8' })
  });
  const blobData = await blobResp.json();
  console.log('Blob Status:', blobResp.status);
  
  // Try to create tree with workflow path
  const treeResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/trees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: commitData.tree.sha,
      tree: [{ path: '.github/workflows/test.yml', mode: '100644', type: 'blob', sha: blobData.sha }]
    })
  });
  const treeData = await treeResp.json();
  console.log('Tree Status:', treeResp.status);
  console.log('Tree Response:', JSON.stringify(treeData, null, 2));
}

main().catch(e => console.error('Error:', e.message));
