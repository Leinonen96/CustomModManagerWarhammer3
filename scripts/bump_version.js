#!/usr/bin/env node

/**
 * Automated Version Control Helper for Warhammer 3 Mod Manager.
 * Synchronizes versions across package.json, src-tauri/Cargo.toml, and src-tauri/tauri.conf.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('❌ Error: Please specify a version (e.g. node scripts/bump_version.js 2.1.0 or patch/minor/major)');
    process.exit(1);
}

function updateFile(filePath, updater) {
    const fullPath = path.join(rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Warning: ${filePath} not found`);
        return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const updated = updater(content);
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log(`✓ Updated ${filePath}`);
}

// Read current version
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let targetVersion = newVersion;

if (['patch', 'minor', 'major'].includes(newVersion.toLowerCase())) {
    const semver = pkg.version.split('.').map(Number);
    if (newVersion === 'major') {
        semver[0] += 1;
        semver[1] = 0;
        semver[2] = 0;
    } else if (newVersion === 'minor') {
        semver[1] += 1;
        semver[2] = 0;
    } else if (newVersion === 'patch') {
        semver[2] += 1;
    }
    targetVersion = semver.join('.');
}

console.log(`📦 Bumping version: ${pkg.version} -> ${targetVersion}`);

// 1. package.json
updateFile('package.json', (content) => {
    const json = JSON.parse(content);
    json.version = targetVersion;
    return JSON.stringify(json, null, 2) + '\n';
});

// 2. package-lock.json (if exists)
updateFile('package-lock.json', (content) => {
    const json = JSON.parse(content);
    json.version = targetVersion;
    if (json.packages && json.packages['']) {
        json.packages[''].version = targetVersion;
    }
    return JSON.stringify(json, null, 2) + '\n';
});

// 3. src-tauri/Cargo.toml
updateFile('src-tauri/Cargo.toml', (content) => {
    return content.replace(/^version = ".*"/m, `version = "${targetVersion}"`);
});

// 4. src-tauri/Cargo.lock (if exists)
updateFile('src-tauri/Cargo.lock', (content) => {
    return content.replace(/(name = "wh3-mod-manager"\r?\nversion = )"[^"]+"/, `$1"${targetVersion}"`);
});

// 5. src-tauri/tauri.conf.json
updateFile('src-tauri/tauri.conf.json', (content) => {
    const json = JSON.parse(content);
    json.version = targetVersion;
    return JSON.stringify(json, null, 2) + '\n';
});

console.log(`\n🎉 Successfully synced all configuration files to v${targetVersion}!`);
console.log(`Next steps to release:`);
console.log(`  git commit -am "chore(release): bump version to v${targetVersion}"`);
console.log(`  git tag v${targetVersion}`);
console.log(`  git push origin main --tags\n`);
