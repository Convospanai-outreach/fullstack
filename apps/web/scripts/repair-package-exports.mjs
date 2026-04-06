import { access, copyFile, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const requireFromWeb = createRequire(path.join(webRoot, 'package.json'));
const repoRoot = path.resolve(webRoot, '..', '..');
const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'));

const PACKAGE_EXPORT_REPAIRS = [
  { packageName: '@reactflow/background' },
  { packageName: '@reactflow/node-toolbar' },
  { packageName: 'reselect', fallbackPath: './dist/reselect.legacy-esm.js' },
];

const DIRECTORY_SYNC_REPAIRS = [
  {
    sourcePackage: 'use-sync-external-store',
    targetRelativePath: 'node_modules/swr/node_modules/use-sync-external-store',
  },
  {
    sourcePackage: 'asynckit',
    targetRelativePath: 'node_modules/axios/node_modules/asynckit',
  },
  {
    sourcePackage: 'oauth',
    targetRelativePath: 'node_modules/next-auth/node_modules/oauth',
  },
  {
    sourcePackage: '@radix-ui/primitive',
    targetRelativePath: 'node_modules/@radix-ui/primitive',
  },
  {
    sourcePackage: '@radix-ui/react-use-controllable-state',
    targetRelativePath: 'node_modules/@radix-ui/react-use-controllable-state',
  },
  {
    sourcePackage: '@radix-ui/react-use-is-hydrated',
    targetRelativePath: 'node_modules/@radix-ui/react-use-is-hydrated',
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPackageJson(startPath) {
  let currentPath = path.dirname(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    const candidate = path.join(currentPath, 'package.json');
    if (await exists(candidate)) {
      return candidate;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

async function repairPackage({ packageName, fallbackPath: configuredFallbackPath }) {
  let packageJsonPath;
  try {
    packageJsonPath = requireFromWeb.resolve(`${packageName}/package.json`);
  } catch {
    try {
      const resolvedEntry = requireFromWeb.resolve(packageName);
      packageJsonPath = await findPackageJson(resolvedEntry);
    } catch {
      return { packageName, status: 'missing-package' };
    }
  }

  if (!packageJsonPath) {
    return { packageName, status: 'missing-package' };
  }

  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const exportTarget = packageJson?.exports?.['.']?.import;

  if (typeof exportTarget !== 'string' || !exportTarget.endsWith('.mjs')) {
    return { packageName, status: 'no-mjs-export' };
  }

  const targetPath = path.join(packageRoot, exportTarget.replace(/^\.\//, ''));
  if (await exists(targetPath)) {
    return { packageName, status: 'already-valid' };
  }

  const fallbackPath = configuredFallbackPath
    ? path.join(packageRoot, configuredFallbackPath.replace(/^\.\//, ''))
    : targetPath.replace(/\.mjs$/, '.js');

  if (!(await exists(fallbackPath))) {
    return { packageName, status: 'missing-fallback' };
  }

  await copyFile(fallbackPath, targetPath);
  return { packageName, status: 'repaired', targetPath };
}

async function syncNestedPackage({ sourcePackage, targetRelativePath }) {
  let sourcePackageJsonPath;
  try {
    sourcePackageJsonPath = requireFromRepo.resolve(`${sourcePackage}/package.json`);
  } catch {
    try {
      const resolvedEntry = requireFromRepo.resolve(sourcePackage);
      sourcePackageJsonPath = await findPackageJson(resolvedEntry);
    } catch {
      return { sourcePackage, status: 'missing-source-package' };
    }
  }

  if (!sourcePackageJsonPath) {
    return { sourcePackage, status: 'missing-source-package' };
  }

  const sourceRoot = path.dirname(sourcePackageJsonPath);
  const targetRoot = path.join(webRoot, targetRelativePath);

  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(path.dirname(targetRoot), { recursive: true });
  await cp(sourceRoot, targetRoot, { recursive: true, force: true });

  return { sourcePackage, status: 'synced', targetRoot };
}

const exportResults = await Promise.all(PACKAGE_EXPORT_REPAIRS.map(repairPackage));
const syncResults = await Promise.all(DIRECTORY_SYNC_REPAIRS.map(syncNestedPackage));
const results = [...exportResults, ...syncResults];
const repaired = results.filter((result) => ['repaired', 'synced'].includes(result.status));
const failed = results.filter((result) =>
  !['already-valid', 'repaired', 'no-mjs-export', 'synced'].includes(result.status),
);

for (const result of repaired) {
  console.log(
    `[repair-package-exports] repaired ${result.packageName ?? result.sourcePackage}`,
  );
}

if (failed.length > 0) {
  console.warn(
    `[repair-package-exports] incomplete: ${failed
      .map((result) => `${result.packageName}:${result.status}`)
      .join(', ')}`,
  );
}
