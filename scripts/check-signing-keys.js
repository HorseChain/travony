const { google } = require('googleapis');
const fs = require('fs');

const apps = {
  rider: 'com.travony.rider',
  driver: 'com.travony.driver'
};

async function checkSigningKeys() {
  const credentials = JSON.parse(fs.readFileSync('attached_assets/replit-publisher-084dbaff4147_1769739843670.json', 'utf8'));
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const androidpublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  for (const [appType, packageName] of Object.entries(apps)) {
    console.log(`\n=== ${appType.toUpperCase()} (${packageName}) ===`);
    
    try {
      // Get app edit session
      const { data: edit } = await androidpublisher.edits.insert({ packageName });
      
      // Try to get bundle information from latest release
      const { data: tracks } = await androidpublisher.edits.tracks.list({
        packageName,
        editId: edit.id
      });
      
      console.log('Release tracks:');
      for (const track of tracks.tracks || []) {
        console.log(`  ${track.track}:`);
        for (const release of track.releases || []) {
          console.log(`    Status: ${release.status}`);
          console.log(`    Version codes: ${release.versionCodes?.join(', ') || 'none'}`);
          if (release.releaseNotes) {
            console.log(`    Notes: ${release.releaseNotes[0]?.text?.substring(0, 50)}...`);
          }
        }
      }
      
      // Clean up edit
      await androidpublisher.edits.delete({ packageName, editId: edit.id });
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
  
  console.log('\n=== NOTE ===');
  console.log('The Google Play API does not expose upload key SHA-1 fingerprints directly.');
  console.log('To verify signing keys, you need to:');
  console.log('1. Check Google Play Console > Release > Setup > App signing');
  console.log('2. Or upload the AAB and see if it matches');
}

checkSigningKeys();
