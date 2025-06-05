#!/bin/bash

rm -rf android/
sed -i '' '/"android":/,/}/d' package.json
sed -i '' '/"react-native-android"/d' package.json
rm -f build.gradle gradle.properties gradlew gradlew.bat
sed -i '' '/android/d' metro.config.js
sed -i '' '/Android/d' README.md
echo "Android components successfully removed. iOS-only structure ready."
