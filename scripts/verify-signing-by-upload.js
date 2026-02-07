const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const apps = {
  rider: { package: 'com.travony.rider', keystore: 'credentials/driver-keystore.jks', pass: 'c557b067f453c9ed618da90628cc8b8e' },
  driver: { package: 'com.travony.driver', keystore: 'credentials/rider-keystore.jks', pass: 'c0e830b36d0813d13abd3c2e3eebb203' }
};

async function checkExpectedFingerprints() {
  console.log('=== CURRENT KEYSTORE FINGERPRINTS ===\n');
  
  const { execSync } = require('child_process');
  
  for (const [appType, config] of Object.entries(apps)) {
    console.log(`${appType.toUpperCase()} app will be signed with:`);
    console.log(`  Keystore: ${config.keystore}`);
    
    try {
      const output = execSync(
        `keytool -list -v -keystore "${config.keystore}" -storepass '${config.pass}' 2>&1 | grep "SHA1:" | head -1`,
        { encoding: 'utf8' }
      );
      console.log(`  ${output.trim()}`);
    } catch (e) {
      console.log(`  Error reading keystore: ${e.message}`);
    }
    console.log();
  }
  
  console.log('=== VERIFICATION NEEDED ===');
  console.log('Please verify in Google Play Console that these fingerprints match:');
  console.log('  T Ride: Release > Setup > App signing > Upload key certificate SHA-1');
  console.log('  T Driver: Release > Setup > App signing > Upload key certificate SHA-1');
  console.log('\nIf they don\'t match, share the expected fingerprints from Google Play Console.');
}

checkExpectedFingerprints();
