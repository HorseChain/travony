const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAMES = {
  rider: 'com.travoney.ride',
  driver: 'com.travoney.driver'
};

async function publishToPlayStore(appVariant, aabPath, track = 'internal') {
  console.log(`Publishing ${appVariant} to ${track} track...`);
  
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set');
  }
  
  const credentials = JSON.parse(serviceAccountJson);
  const packageName = PACKAGE_NAMES[appVariant];
  
  if (!packageName) {
    throw new Error(`Unknown app variant: ${appVariant}`);
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });
  
  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth
  });
  
  try {
    console.log('Creating edit...');
    const editResponse = await androidPublisher.edits.insert({
      packageName
    });
    const editId = editResponse.data.id;
    console.log(`Edit created: ${editId}`);
    
    console.log('Uploading AAB...');
    const aabContent = fs.readFileSync(aabPath);
    const uploadResponse = await androidPublisher.edits.bundles.upload({
      packageName,
      editId,
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(aabPath)
      }
    });
    const versionCode = uploadResponse.data.versionCode;
    console.log(`AAB uploaded, version code: ${versionCode}`);
    
    console.log(`Assigning to ${track} track...`);
    await androidPublisher.edits.tracks.update({
      packageName,
      editId,
      track,
      requestBody: {
        track,
        releases: [{
          versionCodes: [versionCode],
          status: 'completed'
        }]
      }
    });
    console.log(`Assigned to ${track} track`);
    
    console.log('Committing edit...');
    await androidPublisher.edits.commit({
      packageName,
      editId
    });
    console.log('Edit committed successfully!');
    
    console.log(`\n✓ ${appVariant} published to ${track} track!`);
    return { success: true, versionCode };
    
  } catch (error) {
    console.error('Publishing failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

if (require.main === module) {
  const [appVariant, aabPath, track = 'internal'] = process.argv.slice(2);
  
  if (!appVariant || !aabPath) {
    console.log('Usage: node publish-to-play-store.js <rider|driver> <path-to-aab> [track]');
    console.log('Tracks: internal (default), alpha, beta, production');
    process.exit(1);
  }
  
  publishToPlayStore(appVariant, aabPath, track)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { publishToPlayStore };
