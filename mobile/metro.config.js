// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(monorepoRoot, 'shared');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Only watch the shared package folder (not the entire monorepo root)
// This prevents Metro from picking up wrong entry points from root node_modules
config.watchFolders = [sharedRoot];

// 2. Let Metro know where to resolve packages - mobile first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Ensure @rallio/shared resolves to the local package
config.resolver.extraNodeModules = {
  '@rallio/shared': sharedRoot,
};

module.exports = config;