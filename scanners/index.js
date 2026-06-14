const { getBrowserGroupSummary } = require('./browser');
const { getTempGroupSummary, getWindowsCacheGroupSummary, getAppCacheGroupSummary } = require('./system');
const { getRecycleBinGroupSummary } = require('./recycle');
const { listDir } = require('./utils');

async function scanAll(onProgress) {
  const groups = [];

  const steps = [
    { label: 'Scanning browser caches...', fn: getBrowserGroupSummary },
    { label: 'Scanning temporary files...', fn: getTempGroupSummary },
    { label: 'Scanning Windows caches...', fn: getWindowsCacheGroupSummary },
    { label: 'Scanning app caches...', fn: getAppCacheGroupSummary },
    { label: 'Scanning recycle bin...', fn: getRecycleBinGroupSummary },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (onProgress) onProgress({ step: i + 1, total: steps.length, label: step.label });
    try {
      const result = step.fn();
      groups.push(result);
    } catch (err) {
      console.error(`Scanner error: ${err.message}`);
    }
  }

  return groups;
}

async function scanGroup(groupId) {
  // Return detailed file listing for a specific child group
  const parts = groupId.split('-');
  const parentId = parts[0];

  let allGroups;
  try {
    if (parentId === 'browser') {
      const { getBrowserGroupSummary } = require('./browser');
      allGroups = getBrowserGroupSummary();
    } else if (parentId === 'temp') {
      const { getTempGroupSummary } = require('./system');
      allGroups = getTempGroupSummary();
    } else if (parentId === 'windows' || parentId === 'wincache') {
      const { getWindowsCacheGroupSummary } = require('./system');
      allGroups = getWindowsCacheGroupSummary();
    } else if (parentId === 'apps' || parentId === 'app') {
      const { getAppCacheGroupSummary } = require('./system');
      allGroups = getAppCacheGroupSummary();
    } else if (parentId === 'recycle') {
      const { getRecycleBinGroupSummary } = require('./recycle');
      allGroups = getRecycleBinGroupSummary();
    }
  } catch {}

  if (!allGroups) return { files: [] };

  // Find the matching child
  const child = allGroups.children && allGroups.children.find(c => c.id === groupId);
  if (!child) return { files: [] };

  const paths = child.paths || (child.path ? [child.path] : []);
  if (child.virtual || paths.length === 0) return { files: [], virtual: true };

  // List files in each path, label each file with its source folder when multiple paths
  const allFiles = [];
  for (const p of paths) {
    const files = listDir(p, 0);
    allFiles.push(...files);
  }

  return { files: allFiles.sort((a, b) => b.size - a.size) };
}

module.exports = { scanAll, scanGroup };
