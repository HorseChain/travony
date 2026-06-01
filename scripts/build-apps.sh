#!/bin/bash

# Travony App Build Scripts
# Usage: ./scripts/build-apps.sh [rider|driver] [apk|aab|preview]

set -e

APP=$1
BUILD_TYPE=${2:-apk}

if [ -z "$APP" ]; then
    echo "Usage: ./scripts/build-apps.sh [rider|driver] [apk|aab|preview]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/build-apps.sh rider apk      # Build Travony Rider APK"
    echo "  ./scripts/build-apps.sh driver aab     # Build Travony Driver AAB for Play Store"
    echo "  ./scripts/build-apps.sh rider preview  # Build Travony Rider preview for testing"
    exit 1
fi

case $APP in
    rider)
        export APP_VARIANT=rider
        case $BUILD_TYPE in
            apk)
                echo "Building Travony Rider APK..."
                eas build --platform android --profile production-rider --non-interactive
                ;;
            aab)
                echo "Building Travony Rider AAB for Google Play..."
                eas build --platform android --profile production-rider-aab --non-interactive
                ;;
            preview)
                echo "Building Travony Rider Preview..."
                eas build --platform android --profile preview-rider --non-interactive
                ;;
            *)
                echo "Unknown build type: $BUILD_TYPE"
                exit 1
                ;;
        esac
        ;;
    driver)
        export APP_VARIANT=driver
        case $BUILD_TYPE in
            apk)
                echo "Building Travony Driver APK..."
                eas build --platform android --profile production-driver --non-interactive
                ;;
            aab)
                echo "Building Travony Driver AAB for Google Play..."
                eas build --platform android --profile production-driver-aab --non-interactive
                ;;
            preview)
                echo "Building Travony Driver Preview..."
                eas build --platform android --profile preview-driver --non-interactive
                ;;
            *)
                echo "Unknown build type: $BUILD_TYPE"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Unknown app: $APP"
        echo "Use 'rider' or 'driver'"
        exit 1
        ;;
esac

echo "Build complete!"
