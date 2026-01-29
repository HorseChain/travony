let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings?.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
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
    throw new Error('GitHub not connected. Please set up the GitHub integration first.');
  }
  return accessToken;
}

async function githubApi(endpoint: string, options: RequestInit = {}) {
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

async function getUser() {
  return githubApi('/user');
}

async function createRepo(name: string, isPrivate: boolean = false) {
  try {
    return await githubApi('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        private: isPrivate,
        auto_init: false,
        description: 'Travony - Ride Booking Platform'
      }),
    });
  } catch (error: any) {
    if (error.message.includes('422')) {
      console.log('Repository already exists, fetching it...');
      const user = await getUser();
      return githubApi(`/repos/${user.login}/${name}`);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('🔐 Getting GitHub user info...');
    const user = await getUser();
    console.log(`✅ Logged in as: ${user.login}`);
    
    console.log('\n📁 Creating/getting repository...');
    const repo = await createRepo('travony', false);
    console.log(`✅ Repository: ${repo.html_url}`);
    
    console.log('\n📋 Next Steps:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n1️⃣  Add Git remote and push code:');
    console.log(`    git remote add github https://github.com/${user.login}/travony.git`);
    console.log('    git add -A && git commit -m "Push to GitHub" && git push github main');
    
    console.log('\n2️⃣  Add EXPO_TOKEN secret in GitHub:');
    console.log(`    → Go to: ${repo.html_url}/settings/secrets/actions`);
    console.log('    → Click "New repository secret"');
    console.log('    → Name: EXPO_TOKEN');
    console.log('    → Value: (your expo token from expo.dev → Account Settings → Access Tokens)');
    
    console.log('\n3️⃣  Trigger the build:');
    console.log(`    → Go to: ${repo.html_url}/actions`);
    console.log('    → Click "Build Android AAB" workflow');
    console.log('    → Click "Run workflow" → Select "both"');
    
    console.log('\n4️⃣  Download AAB files:');
    console.log('    → After ~20 min, download from the Artifacts section');
    console.log('═══════════════════════════════════════════════════════════════');
    
    return { user, repo };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main();
