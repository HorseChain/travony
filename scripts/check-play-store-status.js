const { google } = require('googleapis');
const fs = require('fs');

const apps = {
  rider: 'com.travony.rider',
  driver: 'com.travony.driver'
};

async function checkStatus(appType) {
  const packageName = apps[appType];
  let credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || fs.readFileSync('/tmp/service-account.json', 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const androidpublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  try {
    console.log(`\n=== ${appType.toUpperCase()} (${packageName}) ===`);

    const { data: edit } = await androidpublisher.edits.insert({ packageName });

    const { data: tracks } = await androidpublisher.edits.tracks.list({
      packageName,
      editId: edit.id
    });

    console.log('Tracks:');
    tracks.tracks?.forEach(track => {
      console.log(`  ${track.track}:`);
      track.releases?.forEach(release => {
        console.log(`    - Status: ${release.status}, Version codes: ${release.versionCodes?.join(', ')}`);
      });
    });

    try {
      const { data: listings } = await androidpublisher.edits.listings.list({
        packageName,
        editId: edit.id
      });
      console.log('Listings:', listings.listings?.length || 0, 'languages');
    } catch (e) {
      console.log('Listings: Unable to fetch');
    }

    await androidpublisher.edits.delete({
      packageName,
      editId: edit.id
    });

  } catch (error) {
    console.error(`Error checking ${appType}:`, error.message);
  }
}

(async () => {
  await checkStatus('rider');
  await checkStatus('driver');
})();
