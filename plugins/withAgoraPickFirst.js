const { withAppBuildGradle } = require("@expo/config-plugins");

// react-native-agora (RTC) and agora-react-native-rtm (RTM) both bundle
// lib/<abi>/libaosl.so. Gradle's mergeNativeLibs fails with
// DuplicateRelativeFileException unless we tell it to pick one copy.
module.exports = function withAgoraPickFirst(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("**/libaosl.so")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android\s*\{/,
        "android {\n    packagingOptions {\n        jniLibs {\n            pickFirsts += ['**/libaosl.so']\n        }\n    }\n"
      );
    }
    return cfg;
  });
};
