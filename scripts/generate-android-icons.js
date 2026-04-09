#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Generate Android icons from the branded SVG logo
 * Run with: node scripts/generate-android-icons.js
 */

// Android icon sizes required for different densities
const ICON_SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192,
};

const FOREGROUND_SIZES = {
  'mdpi': 81,
  'hdpi': 108,
  'xhdpi': 162,
  'xxhdpi': 216,
  'xxxhdpi': 324,
};

// Try to use sharp for SVG to PNG conversion
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: "sharp" package is required to generate icons.');
  console.error('Install it with: npm install --save-dev sharp');
  process.exit(1);
}

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/icons/icon-512x512.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error(`❌ SVG file not found: ${svgPath}`);
    process.exit(1);
  }

  console.log('📱 Generating Android icons from branded logo...\n');

  // Create mipmap directories if they don't exist
  const mipmapDirs = Object.keys(ICON_SIZES).map(density => 
    path.join(__dirname, `../android/app/src/main/res/mipmap-${density}`)
  );

  mipmapDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  try {
    // Generate launcher icons for each density
    for (const [density, size] of Object.entries(ICON_SIZES)) {
      const outputPath = path.join(
        __dirname,
        `../android/app/src/main/res/mipmap-${density}/ic_launcher.png`
      );
      
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ic_launcher.png for ${density} (${size}x${size})`);
    }

    // Generate rounded launcher icons
    for (const [density, size] of Object.entries(ICON_SIZES)) {
      const outputPath = path.join(
        __dirname,
        `../android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`
      );
      
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ic_launcher_round.png for ${density} (${size}x${size})`);
    }

    // Generate foreground icons for adaptive icons
    for (const [density, size] of Object.entries(FOREGROUND_SIZES)) {
      const outputPath = path.join(
        __dirname,
        `../android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`
      );
      
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ic_launcher_foreground.png for ${density} (${size}x${size})`);
    }

    console.log('\n✅ All Android icons generated successfully!');
    console.log('📦 Icons ready for: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi densities');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
