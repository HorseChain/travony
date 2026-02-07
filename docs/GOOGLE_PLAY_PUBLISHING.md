# Publishing Travony to Google Play Store

This guide explains how to build and publish the two separate Travony apps to Google Play Store:
- **Travony** (for riders/passengers)
- **Travony Driver** (for drivers)

## Prerequisites

1. **Expo Account**: Sign up at https://expo.dev
2. **EAS CLI**: Install globally with `npm install -g eas-cli`
3. **Google Play Developer Account**: Register at https://play.google.com/console ($25 one-time fee)
4. **Google Play Service Account**: For automated uploads (optional but recommended)

## Step 1: Configure Expo Account

```bash
# Login to Expo
eas login

# Link your project (first time only)
eas init
```

## Step 2: Build the Apps

### Building APKs (for direct installation/testing)

```bash
# Build Travony Rider APK
./scripts/build-apps.sh rider apk

# Build Travony Driver APK
./scripts/build-apps.sh driver apk
```

### Building AAB (for Google Play Store - required)

Google Play requires Android App Bundles (.aab) for new apps:

```bash
# Build Travony Rider AAB for Play Store
./scripts/build-apps.sh rider aab

# Build Travony Driver AAB for Play Store
./scripts/build-apps.sh driver aab
```

### Building Preview (for internal testing)

```bash
# Build preview versions for testing
./scripts/build-apps.sh rider preview
./scripts/build-apps.sh driver preview
```

## Step 3: Download Built Apps

After the build completes, download from your Expo dashboard:
1. Go to https://expo.dev
2. Navigate to your project
3. Click on the build
4. Download the .aab file

## Step 4: Create Google Play Store Listings

### For Travony (Rider App)

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name**: Travony
   - **Default language**: English (US)
   - **App or game**: App
   - **Free or paid**: Free
4. Accept declarations

### For Travony Driver

Repeat the process with:
- **App name**: Travony Driver

## Step 5: Complete Store Listing

For each app, you'll need:

### Required Information
- **Short description** (up to 80 characters)
- **Full description** (up to 4000 characters)
- **App icon**: 512x512 PNG (already generated in assets/images/)
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: At least 2 phone screenshots

### App Content
- Privacy policy URL
- App category
- Contact email
- Content rating questionnaire

### Suggested Descriptions

**Travony (Rider)**:
- Short: "Book rides instantly with AI-powered driver matching"
- Category: Travel & Local

**Travony Driver**:
- Short: "Earn on your schedule with smart ride matching"
- Category: Travel & Local

## Step 6: Upload the AAB

1. Go to "Release" > "Production" > "Create new release"
2. Upload the .aab file from Step 3
3. Add release notes
4. Review and roll out

## Step 7: Submit for Review

Google reviews typically take 1-3 days for new apps.

## App Package Names

The apps are configured with distinct package names for separate Play Store listings:

| App | Package Name | Bundle Identifier |
|-----|-------------|-------------------|
| Travony Rider | `com.travony.rider` | `com.travony.rider` |
| Travony Driver | `com.travony.driver` | `com.travony.driver` |

## Automated Submission (Optional)

For automated uploads, set up a Google Play Service Account:

1. Go to Google Cloud Console
2. Create a Service Account with Play Console access
3. Download the JSON key
4. Save as `google-play-service-account.json` in project root
5. Use EAS submit:

```bash
# Submit Rider app
eas submit --platform android --profile production-rider

# Submit Driver app  
eas submit --platform android --profile production-driver
```

## Environment Variables for EAS

Set these in your EAS project settings or `.env`:

- `EAS_PROJECT_ID`: Your Expo project ID

## Versioning

Before each new release, update the version in:
- `app.rider.json` - for rider app
- `app.driver.json` - for driver app

Increment both `version` (display) and ensure Android `versionCode` increases.

## Testing Before Release

1. Build preview versions first
2. Test on real devices
3. Check all features work for the specific user role
4. Verify the correct screens appear (rider screens vs driver screens)

## Troubleshooting

### Build Fails
- Check `eas build` logs on expo.dev
- Ensure all native dependencies are compatible

### App Rejected
- Review Google Play policy violations
- Update privacy policy if needed
- Fix any content rating issues

### Wrong Screens Showing
- Verify `APP_VARIANT` environment variable is set correctly during build
- Check that app.config.js is properly selecting the right config

## Support

For issues with:
- **EAS builds**: https://docs.expo.dev/build/introduction/
- **Google Play Console**: https://support.google.com/googleplay/android-developer/
