#!/bin/bash

# SMS Mirror App - Android Cleanup Script
# This script removes all Android-related files and folders for iOS-only development


echo "🧹 Starting Android cleanup for SMS Mirror App..."
echo "⚠️  This will permanently delete all Android-related files!"
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm != [yY] ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo ""
echo "📁 Removing Android directories and files..."

# Remove entire Android directory
if [ -d "android" ]; then
    echo "  ✅ Removing android/ directory..."
    rm -rf android/
else
    echo "  ⚠️  android/ directory not found"
fi

# Remove Android-specific files from root
android_files=(
    "android.keystore"
    "keystore.properties"
    "android-release.aab"
    "android-release.apk"
    ".android"
)

for file in "${android_files[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "  ✅ Removing $file..."
        rm -rf "$file"
    fi
done

echo ""
echo "📄 Updating configuration files..."

# Update package.json to remove Android dependencies
if [ -f "package.json" ]; then
    echo "  ✅ Cleaning package.json Android dependencies..."

    # Create backup
    cp package.json package.json.backup

    # Remove Android-specific scripts and dependencies
    python3 -c "
import json
import sys

try:
    with open('package.json', 'r') as f:
        package = json.load(f)

    # Remove Android scripts
    if 'scripts' in package:
        android_scripts = ['android', 'android:dev', 'android:release', 'build:android']
        for script in android_scripts:
            package['scripts'].pop(script, None)

    # Remove Android dependencies
    android_deps = [
        '@react-native-community/geolocation',
        'react-native-device-info',
        'react-native-permissions'
    ]

    if 'dependencies' in package:
        for dep in android_deps:
            package['dependencies'].pop(dep, None)

    if 'devDependencies' in package:
        for dep in android_deps:
            package['devDependencies'].pop(dep, None)

    with open('package.json', 'w') as f:
        json.dump(package, f, indent=2)

    print('✅ package.json updated successfully')

except Exception as e:
    print(f'❌ Error updating package.json: {e}')
    print('   Please manually remove Android-specific dependencies')
"
fi

# Update .gitignore to remove Android entries
if [ -f ".gitignore" ]; then
    echo "  ✅ Cleaning .gitignore Android entries..."

    # Create backup
    cp .gitignore .gitignore.backup

    # Remove Android-specific entries
    sed -i.bak '/# Android/,/^$/d' .gitignore
    sed -i.bak '/android\//d' .gitignore
    sed -i.bak '/\.gradle/d' .gitignore
    sed -i.bak '/local\.properties/d' .gitignore
    sed -i.bak '/\.keystore/d' .gitignore
    rm .gitignore.bak
fi

# Update README.md to remove Android instructions
if [ -f "README.md" ]; then
    echo "  ✅ Cleaning README.md Android references..."

    # Create backup
    cp README.md README.md.backup

    # Remove Android-specific sections
    sed -i.bak '/### Android/,/^$/d' README.md
    sed -i.bak '/npx react-native run-android/d' README.md
    sed -i.bak '/android\//d' README.md
    rm README.md.bak
fi

echo ""
echo "🧽 Cleaning React Native Metro cache..."
if [ -d "node_modules" ]; then
    npx react-native-clean-project --remove-iOS-build --remove-iOS-pods
fi

echo ""
echo "📱 iOS-only project structure:"
echo "sms-mirror-app/"
echo "├── ios/                     # iOS native code"
echo "├── src/                     # React Native source"
echo "├── backend/                 # Node.js backend"
echo "├── docs/                    # Documentation"
echo "├── scripts/                 # Build scripts"
echo "├── package.json            # Dependencies"
echo "└── README.md               # Instructions"

echo ""
echo "✅ Android cleanup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Run: npm install"
echo "   2. Run: cd ios && pod install"
echo "   3. Open ios/SMSMirror.xcworkspace in Xcode"
echo "   4. Follow iOS installation instructions"
echo ""
echo "💾 Backups created:"
echo "   - package.json.backup"
echo "   - .gitignore.backup" 
echo "   - README.md.backup"

