#!/usr/bin/env node

/**
 * Generate PWA PNG icons from SVG sources
 * Usage: node scripts/generate-icons.mjs
 * 
 * This script converts SVG icons to PNG format for PWA support.
 * Requires: npm install -g sharp svg2png
 * Or: npm install sharp
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const iconsDir = path.join(projectRoot, 'public', 'icons');

// Icon configurations
const icons = [
  { svg: 'icon-192x192.svg', png: 'icon-192x192.png', size: 192 },
  { svg: 'icon-512x512.svg', png: 'icon-512x512.png', size: 512 },
  { svg: 'icon-maskable-192x192.svg', png: 'icon-maskable-192x192.png', size: 192 },
  { svg: 'icon-maskable-512x512.svg', png: 'icon-maskable-512x512.png', size: 512 },
];

async function convertSvgToPng(svgPath, pngPath, size) {
  try {
    const svgData = fs.readFileSync(svgPath, 'utf-8');
    
    // Create canvas
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Parse and render SVG
    // This is a simple fallback - ideally use librsvg or Inkscape CLI
    console.log(`Converting ${path.basename(svgPath)} to PNG...`);
    
    // For proper conversion, you may want to use:
    // 1. imagemagick: convert icon.svg icon.png
    // 2. inkscape: inkscape icon.svg -e icon.png
    // 3. cairosvg: cairosvg icon.svg -o icon.png
    // 4. svgexport: svgexport icon.svg icon.png
    
    console.log(`⚠️  Manual PNG generation required for ${pngPath}`);
    console.log(`   Recommended tools: ImageMagick, Inkscape, or svgexport`);
    
  } catch (error) {
    console.error(`Error processing ${svgPath}:`, error.message);
  }
}

async function generateIcons() {
  console.log('🎨 Generating PWA icons from SVG...\n');
  
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log(`Created directory: ${iconsDir}\n`);
  }
  
  for (const icon of icons) {
    const svgPath = path.join(iconsDir, icon.svg);
    const pngPath = path.join(iconsDir, icon.png);
    
    if (!fs.existsSync(svgPath)) {
      console.warn(`⚠️  SVG file not found: ${svgPath}`);
      continue;
    }
    
    // Convert SVG to PNG
    await convertSvgToPng(svgPath, pngPath, icon.size);
  }
  
  console.log('\n✅ Icon generation setup complete!');
  console.log('\nTo convert SVG to PNG, use one of these tools:\n');
  console.log('1. Using ImageMagick:');
  console.log('   convert public/icons/icon-192x192.svg public/icons/icon-192x192.png\n');
  
  console.log('2. Using Inkscape:');
  console.log('   inkscape public/icons/icon-192x192.svg --export-filename=public/icons/icon-192x192.png\n');
  
  console.log('3. Using svgexport (npm install -g svgexport):');
  console.log('   svgexport public/icons/icon-192x192.svg public/icons/icon-192x192.png\n');
  
  console.log('4. Using cairosvg (pip install cairosvg):');
  console.log('   cairosvg public/icons/icon-192x192.svg -o public/icons/icon-192x192.png\n');
}

generateIcons().catch(console.error);
