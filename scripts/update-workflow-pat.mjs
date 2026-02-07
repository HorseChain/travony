async function main() {
  const token = process.env.GITHUB_PAT;
  
  if (!token) {
    console.error('GITHUB_PAT not found!');
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  
  const workflowContent = `name: Build Android AAB

on:
  workflow_dispatch:
    inputs:
      app_variant:
        description: 'Which app to build'
        required: true
        default: 'rider'
        type: choice
        options:
          - rider
          - driver
          - both

jobs:
  build-rider:
    if: \${{ github.event.inputs.app_variant == 'rider' || github.event.inputs.app_variant == 'both' }}
    runs-on: ubuntu-latest
    env:
      GOOGLE_API_KEY: \${{ secrets.GOOGLE_API_KEY }}
      GRADLE_OPTS: -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m"
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm ci

      - name: Setup Expo CLI
        run: npm install -g expo-cli

      - name: Copy rider app config
        run: cp app.rider.json app.json

      - name: Generate Android project
        run: npx expo prebuild --platform android --clean

      - name: Fix Google API Key placeholder
        run: |
          sed -i 's/\\$\{GOOGLE_API_KEY\\}/'\$GOOGLE_API_KEY'/g' android/app/src/main/AndroidManifest.xml
          grep -i "geo.API_KEY" android/app/src/main/AndroidManifest.xml || true

      - name: Build Debug AAB with Gradle
        working-directory: android
        run: ./gradlew bundleDebug --stacktrace

      - name: Rename output
        run: mv android/app/build/outputs/bundle/debug/app-debug.aab t-ride.aab

      - name: Upload T Ride AAB
        uses: actions/upload-artifact@v4
        with:
          name: t-ride-aab
          path: t-ride.aab
          retention-days: 30

  build-driver:
    if: \${{ github.event.inputs.app_variant == 'driver' || github.event.inputs.app_variant == 'both' }}
    runs-on: ubuntu-latest
    env:
      GOOGLE_API_KEY: \${{ secrets.GOOGLE_API_KEY }}
      GRADLE_OPTS: -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m"
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm ci

      - name: Setup Expo CLI
        run: npm install -g expo-cli

      - name: Copy driver app config
        run: cp app.driver.json app.json

      - name: Generate Android project
        run: npx expo prebuild --platform android --clean

      - name: Fix Google API Key placeholder
        run: |
          sed -i 's/\\$\{GOOGLE_API_KEY\\}/'\$GOOGLE_API_KEY'/g' android/app/src/main/AndroidManifest.xml
          grep -i "geo.API_KEY" android/app/src/main/AndroidManifest.xml || true

      - name: Build Debug AAB with Gradle
        working-directory: android
        run: ./gradlew bundleDebug --stacktrace

      - name: Rename output
        run: mv android/app/build/outputs/bundle/debug/app-debug.aab t-driver.aab

      - name: Upload T Driver AAB
        uses: actions/upload-artifact@v4
        with:
          name: t-driver-aab
          path: t-driver.aab
          retention-days: 30
`;

  // Get current main ref
  const refResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/ref/heads/main', { headers });
  const refData = await refResp.json();
  const currentSha = refData.object.sha;
  console.log('Current SHA:', currentSha);
  
  // Get base tree
  const commitResp = await fetch(`https://api.github.com/repos/HorseChain/travony/git/commits/${currentSha}`, { headers });
  const commitData = await commitResp.json();
  
  // Create blob
  const blobResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/blobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: workflowContent, encoding: 'utf-8' })
  });
  const blobData = await blobResp.json();
  console.log('Blob created:', blobData.sha ? 'Yes' : 'No');
  
  // Create tree
  const treeResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/trees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: commitData.tree.sha,
      tree: [{ path: '.github/workflows/build-android.yml', mode: '100644', type: 'blob', sha: blobData.sha }]
    })
  });
  const treeData = await treeResp.json();
  console.log('Tree created:', treeData.sha ? 'Yes' : 'No');
  
  // Create commit
  const newCommitResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/commits', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'Fix Google API Key placeholder substitution in manifest',
      tree: treeData.sha,
      parents: [currentSha]
    })
  });
  const newCommitData = await newCommitResp.json();
  console.log('Commit created:', newCommitData.sha ? 'Yes' : 'No');
  
  // Update ref
  const updateResp = await fetch('https://api.github.com/repos/HorseChain/travony/git/refs/heads/main', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: newCommitData.sha })
  });
  console.log('Workflow updated:', updateResp.ok ? 'Success!' : 'Failed');
  
  if (updateResp.ok) {
    // Trigger build
    console.log('Triggering build...');
    const dispatchResp = await fetch('https://api.github.com/repos/HorseChain/travony/actions/workflows/build-android.yml/dispatches', {
      method: 'POST',
      headers: { ...headers, 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', inputs: { app_variant: 'both' } })
    });
    console.log('Build triggered:', dispatchResp.status === 204 ? 'Yes!' : 'No - ' + dispatchResp.status);
  }
}

main().catch(e => console.error('Error:', e.message));
