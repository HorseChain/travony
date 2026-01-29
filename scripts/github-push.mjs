import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings?.settings?.access_token) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=github`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function githubApi(endpoint, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function getRepoPublicKey(owner, repo) {
  return githubApi(`/repos/${owner}/${repo}/actions/secrets/public-key`);
}

async function setRepoSecret(owner, repo, secretName, secretValue) {
  const publicKey = await getRepoPublicKey(owner, repo);
  
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(publicKey.key, 'base64');
  
  const sodium = await import('tweetnacl').then(m => m.default || m).catch(() => null);
  
  if (!sodium) {
    console.log('Note: Cannot set secret automatically. Please set it manually.');
    return { success: false, manual: true };
  }
  
  const encryptedBytes = sodium.box.seal(messageBytes, keyBytes);
  const encryptedValue = Buffer.from(encryptedBytes).toString('base64');
  
  const token = await getAccessToken();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: publicKey.key_id,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set secret: ${response.status} - ${error}`);
  }
  
  return { success: true };
}

async function getDefaultBranch(owner, repo) {
  const repoInfo = await githubApi(`/repos/${owner}/${repo}`);
  return repoInfo.default_branch || 'main';
}

async function getLatestCommit(owner, repo, branch) {
  try {
    const ref = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    return ref.object.sha;
  } catch (e) {
    return null;
  }
}

async function createBlob(owner, repo, content) {
  return githubApi(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    })
  });
}

async function createTree(owner, repo, baseTree, tree) {
  return githubApi(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTree,
      tree
    })
  });
}

async function createCommit(owner, repo, message, treeSha, parentSha) {
  const body = {
    message,
    tree: treeSha,
  };
  if (parentSha) {
    body.parents = [parentSha];
  }
  return githubApi(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

async function updateRef(owner, repo, branch, sha) {
  try {
    return await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha, force: true })
    });
  } catch (e) {
    return await githubApi(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha })
    });
  }
}

function getAllFiles(dir, baseDir = dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache' || 
        entry.name === '.expo' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else {
      try {
        const content = fs.readFileSync(fullPath);
        if (content.length < 100 * 1024 * 1024) {
          files.push({ path: relativePath, content });
        }
      } catch (e) {
      }
    }
  }
  
  return files;
}

async function triggerWorkflow(owner, repo, workflowFile, ref, inputs) {
  const token = await getAccessToken();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref,
      inputs,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to trigger workflow: ${response.status} - ${error}`);
  }
  
  return { success: true };
}

async function main() {
  const owner = 'HorseChain';
  const repo = 'travony';
  const branch = 'main';
  
  try {
    console.log('📦 Collecting files to push...');
    const projectDir = '/home/runner/workspace';
    const files = getAllFiles(projectDir);
    console.log(`   Found ${files.length} files`);
    
    console.log('\n🔄 Creating blobs for files...');
    const treeItems = [];
    let processed = 0;
    
    for (const file of files) {
      try {
        const blob = await createBlob(owner, repo, file.content);
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        });
        processed++;
        if (processed % 50 === 0) {
          console.log(`   Processed ${processed}/${files.length} files...`);
        }
      } catch (e) {
        console.log(`   Skipping ${file.path}: ${e.message}`);
      }
    }
    console.log(`   Created ${treeItems.length} blobs`);
    
    console.log('\n🌳 Creating tree...');
    const latestCommit = await getLatestCommit(owner, repo, branch);
    const tree = await createTree(owner, repo, latestCommit, treeItems);
    console.log(`   Tree SHA: ${tree.sha}`);
    
    console.log('\n📝 Creating commit...');
    const commit = await createCommit(owner, repo, 'Push Travony code from Replit', tree.sha, latestCommit);
    console.log(`   Commit SHA: ${commit.sha}`);
    
    console.log('\n🚀 Updating branch reference...');
    await updateRef(owner, repo, branch, commit.sha);
    console.log(`   Branch ${branch} updated!`);
    
    console.log('\n🔑 Setting up EXPO_TOKEN secret...');
    const expoToken = process.env.EXPO_TOKEN;
    if (expoToken) {
      console.log('   EXPO_TOKEN found, attempting to set...');
      console.log('   Note: You may need to set this manually if it fails.');
      console.log(`   Go to: https://github.com/${owner}/${repo}/settings/secrets/actions`);
    } else {
      console.log('   EXPO_TOKEN not found in environment.');
      console.log(`   Please set it manually at: https://github.com/${owner}/${repo}/settings/secrets/actions`);
    }
    
    console.log('\n⏳ Waiting before triggering workflow...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🎯 Triggering build workflow...');
    try {
      await triggerWorkflow(owner, repo, 'build-android.yml', branch, { app_variant: 'both' });
      console.log('   Build workflow triggered!');
    } catch (e) {
      console.log(`   Could not trigger workflow automatically: ${e.message}`);
      console.log(`   Please trigger manually at: https://github.com/${owner}/${repo}/actions`);
    }
    
    console.log('\n✅ Done! Check your builds at:');
    console.log(`   https://github.com/${owner}/${repo}/actions`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

main();
