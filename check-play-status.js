const { google } = require('googleapis');
const fs = require('fs');

const APPS = {
  rider: 'com.travony.rider',
  driver: 'com.travony.driver'
};

async function checkPlayStatus() {
  const serviceAccountPath = 'attached_assets/replit-publisher-084dbaff4147_1769739843670.json';
  const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });
  
  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth
  });
  
  for (const [name, packageName] of Object.entries(APPS)) {
    console.log(`\n=== ${name.toUpperCase()} (${packageName}) ===`);
    
    try {
      const editResponse = await androidPublisher.edits.insert({ packageName });
      const editId = editResponse.data.id;
      
      const tracks = ['internal', 'alpha', 'beta', 'production'];
      for (const track of tracks) {
        try {
          const trackInfo = await androidPublisher.edits.tracks.get({
            packageName,
            editId,
            track
          });
          
          if (trackInfo.data.releases?.length > 0) {
            for (const release of trackInfo.data.releases) {
              console.log(`  ${track.toUpperCase()}: Version ${release.versionCodes?.[0] || 'N/A'} - Status: ${release.status || 'unknown'}`);
              if (release.name) console.log(`    Release name: ${release.name}`);
            }
          }
        } catch (e) {
          // Track not configured
        }
      }
      
      await androidPublisher.edits.delete({ packageName, editId });
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

checkPlayStatus().catch(console.error);
