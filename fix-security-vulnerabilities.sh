#!/bin/bash

echo "🔒 开始修复安全漏洞..."

# 1. 备份当前文件
echo "📦 备份当前 package.json 和 yarn.lock..."
cp package.json package.json.backup
cp yarn.lock yarn.lock.backup

# 2. 升级直接依赖
echo "⬆️  升级直接依赖..."
yarn add hardhat@^2.22.0
yarn add ethers@^6.13.0
yarn add mocha@^10.7.0
yarn add ts-node@^10.9.2
yarn add tsup@^8.3.5

# 3. 添加 resolutions 到 package.json
echo "🔧 添加依赖解析配置..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.resolutions = {
  'axios': '>=1.7.0',
  'form-data': '>=4.0.4',
  'js-yaml': '>=4.1.1',
  'nanoid': '>=3.3.8',
  'serialize-javascript': '>=6.0.2',
  'cookie': '>=0.7.0',
  'tmp': '>=0.2.4',
  'esbuild': '>=0.25.0'
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# 4. 强制重新安装依赖
echo "🔄 重新安装依赖..."
rm -rf node_modules yarn.lock
yarn install

# 5. 运行安全审计
echo "🔍 运行安全审计..."
yarn audit --summary

echo "✅ 安全漏洞修复完成！"
echo "📋 请运行测试确保一切正常："
echo "   yarn evm:test"
echo "   yarn svm:test"