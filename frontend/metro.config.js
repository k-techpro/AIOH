// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);
const backend=process.env.EXPO_PUBLIC_DATABASE_BACKEND||'neon';
if(!['neon','firestore'].includes(backend))throw new Error('Invalid database backend.');
if(backend==='neon'){
 config.resolver.resolveRequest=(context,moduleName,platform)=>{
  if(/\.firestore(?:\.tsx?)?$/.test(moduleName))return{type:'sourceFile',filePath:path.join(__dirname,'src/services/forbiddenFirestore.ts')};
  return context.resolveRequest(context,moduleName,platform);
 };
}

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
