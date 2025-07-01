#!/usr/bin/env node

/**
 * Storage Manager Pro - 自动化发布脚本
 * 
 * 功能：
 * 1. 构建生产版本
 * 2. 同步版本号
 * 3. 创建 ZIP 打包文件
 * 4. 提交代码变更
 * 5. 创建 Git tag
 * 6. 推送到远程仓库
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function step(message) {
  log(`\n🚀 ${message}`, 'cyan');
}

// 执行命令
function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options,
    });
    return result;
  } catch (err) {
    error(`Command failed: ${command}`);
    error(err.message);
    process.exit(1);
  }
}

// 读取 JSON 文件
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(path.resolve(rootDir, filePath), 'utf8');
    return JSON.parse(content);
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

// 写入 JSON 文件
function writeJSON(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(path.resolve(rootDir, filePath), content + '\n');
  } catch (err) {
    error(`Failed to write ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

// 验证版本号格式
function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

// 检查工作目录是否干净
function checkWorkingDirectory() {
  try {
    const status = execSync('git status --porcelain', { 
      cwd: rootDir, 
      encoding: 'utf8',
      stdio: 'pipe',
    });
    
    if (status.trim()) {
      warning('Working directory has uncommitted changes:');
      console.log(status);
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      return new Promise((resolve) => {
        rl.question('Do you want to continue? (y/N): ', (answer) => {
          rl.close();
          if (answer.toLowerCase() !== 'y') {
            info('Release cancelled.');
            process.exit(0);
          }
          resolve();
        });
      });
    }
  } catch (err) {
    warning('Could not check git status. Continuing...');
  }
}

// 获取当前版本
function getCurrentVersion() {
  const packageJson = readJSON('package.json');
  return packageJson.version;
}

// 更新版本号
function updateVersion(newVersion) {
  step(`Updating version to ${newVersion}`);
  
  // 更新 package.json
  const packageJson = readJSON('package.json');
  packageJson.version = newVersion;
  writeJSON('package.json', packageJson);
  success('Updated package.json');
  
  // 更新 manifest.json
  const manifestJson = readJSON('public/manifest.json');
  manifestJson.version = newVersion;
  writeJSON('public/manifest.json', manifestJson);
  success('Updated public/manifest.json');
}

// 构建项目
function buildProject() {
  step('Building project');
  exec('npm run build');
  success('Build completed');
}

// 创建 ZIP 包
function createZipPackage(version) {
  step('Creating ZIP package');
  
  const zipName = `storage-manager-pro-v${version}.zip`;
  const zipPath = path.resolve(rootDir, zipName);
  
  // 删除旧的 ZIP 文件
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  exec(`zip -r ${zipName} dist/`);
  success(`Created ${zipName}`);
  
  return zipName;
}

// 提交更改
function commitChanges(version) {
  step('Committing changes');
  
  exec('git add .');
  exec(`git commit -m "chore: release v${version}

- Updated version to ${version}
- Built production assets
- Updated documentation"`);
  
  success('Changes committed');
}

// 创建 Git tag
function createTag(version) {
  step('Creating Git tag');
  
  const tagName = `v${version}`;
  exec(`git tag -a ${tagName} -m "Release ${tagName}"`);
  success(`Created tag ${tagName}`);
}

// 推送到远程仓库
function pushToRemote(version) {
  step('Pushing to remote repository');
  
  exec('git push origin main');
  exec(`git push origin v${version}`);
  success('Pushed to remote repository');
}

// 主函数
async function main() {
  log('\n🎯 Storage Manager Pro - Release Script', 'bright');
  log('=====================================\n', 'bright');
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  let newVersion = args[0];
  
  // 检查工作目录
  await checkWorkingDirectory();
  
  // 获取当前版本
  const currentVersion = getCurrentVersion();
  info(`Current version: ${currentVersion}`);
  
  // 如果没有提供版本号，自动递增
  if (!newVersion) {
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[2]++; // 递增补丁版本
    newVersion = versionParts.join('.');
    info(`Auto-incrementing to: ${newVersion}`);
  }
  
  // 验证版本号
  if (!validateVersion(newVersion)) {
    error(`Invalid version format: ${newVersion}`);
    error('Version should be in format: x.y.z');
    process.exit(1);
  }
  
  // 检查版本是否比当前版本新
  if (newVersion <= currentVersion) {
    error(`New version (${newVersion}) must be greater than current version (${currentVersion})`);
    process.exit(1);
  }
  
  try {
    // 执行发布流程
    updateVersion(newVersion);
    buildProject();
    const zipName = createZipPackage(newVersion);
    commitChanges(newVersion);
    createTag(newVersion);
    pushToRemote(newVersion);
    
    // 发布成功
    log('\n🎉 Release completed successfully!', 'green');
    log('================================\n', 'green');
    success(`Version: ${newVersion}`);
    success(`ZIP package: ${zipName}`);
    success(`Git tag: v${newVersion}`);
    success('Changes pushed to remote repository');
    
    info('\nNext steps:');
    info('1. Upload the ZIP file to Chrome Web Store');
    info('2. Create a GitHub release with the ZIP file');
    info('3. Update any external documentation');
    
  } catch (err) {
    error(`Release failed: ${err.message}`);
    process.exit(1);
  }
}

// 运行脚本
main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
