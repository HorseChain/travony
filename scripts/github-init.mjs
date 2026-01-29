import * as fs from 'fs';
import * as path from 'path';

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
  return connectionSettings?.settings?.access_token;
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
  
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} - ${text}`);
  }
  
  return text ? JSON.parse(text) : {};
}

async function createOrUpdateFile(owner, repo, filePath, content, message, sha = null) {
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
  };
  if (sha) body.sha = sha;
  
  return githubApi(`/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

async function getFile(owner, repo, filePath) {
  try {
    return await githubApi(`/repos/${owner}/${repo}/contents/${filePath}`);
  } catch (e) {
    return null;
  }
}

function getAllFiles(dir, baseDir = dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  const skipDirs = ['node_modules', '.git', '.cache', '.expo', 'dist', 'static-build', 'attached_assets'];
  const skipExts = ['.lock', '.log'];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (skipDirs.includes(entry.name) || entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else {
      const ext = path.extname(entry.name);
      if (skipExts.includes(ext)) continue;
      
      try {
        const content = fs.readFileSync(fullPath);
        if (content.length < 1024 * 1024) {
          files.push({ path: relativePath, content: content.toString('utf-8') });
        }
      } catch (e) {}
    }
  }
  
  return files;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    body: JSON.stringify({ ref, inputs }),
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
  
  try {
    console.log('📝 Initializing repository with README...');
    await createOrUpdateFile(owner, repo, 'README.md', 
      '# Travony - Ride Booking Platform\n\nA modern ride-hailing platform with Intent-Based Mobility.',
      'Initial commit');
    console.log('   README created!');
    
    await sleep(2000);
    
    console.log('\n📦 Collecting essential files...');
    const projectDir = '/home/runner/workspace';
    const allFiles = getAllFiles(projectDir);
    
    const essentialPaths = [
      'package.json',
      'tsconfig.json', 
      'babel.config.js',
      'app.json',
      'app.config.js',
      'app.rider.json',
      'app.driver.json',
      'eas.json',
      'metro.config.js',
      'replit.md',
      'design_guidelines.md'
    ];
    
    const essentialDirs = ['client/', 'server/', 'shared/', 'scripts/', '.github/'];
    
    const files = allFiles.filter(f => {
      if (essentialPaths.includes(f.path)) return true;
      for (const dir of essentialDirs) {
        if (f.path.startsWith(dir)) return true;
      }
      return false;
    });
    
    console.log(`   Found ${files.length} essential files to push`);
    
    console.log('\n🚀 Pushing files to GitHub...');
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const existing = await getFile(owner, repo, file.path);
        await createOrUpdateFile(owner, repo, file.path, file.content, 
          `Add ${file.path}`, existing?.sha);
        success++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${files.length} files...`);
          await sleep(1000);
        }
      } catch (e) {
        if (e.message.includes('rate limit')) {
          console.log('   Rate limited, waiting 60 seconds...');
          await sleep(60000);
          i--;
          continue;
        }
        failed++;
        console.log(`   Failed: ${file.path} - ${e.message.substring(0, 50)}`);
      }
    }
    
    console.log(`\n✅ Pushed ${success} files, ${failed} failed`);
    
    console.log('\n🔑 EXPO_TOKEN secret:');
    console.log(`   Please add manually at: https://github.com/${owner}/${repo}/settings/secrets/actions`);
    console.log('   Name: EXPO_TOKEN');
    console.log('   Value: Your Expo token from expo.dev');
    
    console.log('\n⏳ Waiting before triggering workflow...');
    await sleep(5000);
    
    console.log('\n🎯 Triggering build workflow...');
    try {
      await triggerWorkflow(owner, repo, 'build-android.yml', 'main', { app_variant: 'both' });
      console.log('   Build workflow triggered!');
    } catch (e) {
      console.log(`   Cannot trigger yet: ${e.message}`);
      console.log(`   Trigger manually: https://github.com/${owner}/${repo}/actions`);
    }
    
    console.log('\n✅ Done! Repository: https://github.com/' + owner + '/' + repo);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
