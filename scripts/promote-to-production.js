const { google } = require('googleapis');
const fs = require('fs');

const apps = {
  rider: 'com.travony.rider',
  driver: 'com.travony.driver'
};

async function promoteToProduction(appType) {
  const packageName = apps[appType];
  if (!packageName) {
    console.error(`Unknown app type: ${appType}`);
    process.exit(1);
  }

  let credentials;
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  } else if (fs.existsSync('service-account.json')) {
    credentials = JSON.parse(fs.readFileSync('service-account.json', 'utf8'));
  } else {
    console.error('No service account credentials found');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const androidpublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  try {
    console.log(`Promoting ${appType} (${packageName}) to production...`);

    const { data: edit } = await androidpublisher.edits.insert({
      packageName
    });
    console.log(`Edit created: ${edit.id}`);

    const { data: internalTrack } = await androidpublisher.edits.tracks.get({
      packageName,
      editId: edit.id,
      track: 'internal'
    });

    if (!internalTrack.releases || internalTrack.releases.length === 0) {
      console.error('No internal releases found');
      process.exit(1);
    }

    const latestRelease = internalTrack.releases[0];
    console.log(`Found internal release: version codes ${latestRelease.versionCodes?.join(', ')}`);

    await androidpublisher.edits.tracks.update({
      packageName,
      editId: edit.id,
      track: 'production',
      requestBody: {
        track: 'production',
        releases: [{
          versionCodes: latestRelease.versionCodes,
          status: 'completed',
          releaseNotes: [{
            language: 'en-US',
            text: 'Initial release'
          }]
        }]
      }
    });
    console.log('Production track updated');

    await androidpublisher.edits.commit({
      packageName,
      editId: edit.id
    });
    console.log(`SUCCESS: ${appType} promoted to production!`);

  } catch (error) {
    console.error('Promotion failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

const appType = process.argv[2];
if (!appType || !['rider', 'driver', 'both'].includes(appType)) {
  console.log('Usage: node promote-to-production.js <rider|driver|both>');
  process.exit(1);
}

if (appType === 'both') {
  (async () => {
    await promoteToProduction('rider');
    await promoteToProduction('driver');
  })();
} else {
  promoteToProduction(appType);
}
