#!/bin/bash
# quick-mint.sh - 快速发行 DID 脚本

set -e

echo "=== Solana Legal DID 快速发行 ==="
echo ""

# 检查依赖
if ! command -v ts-node &> /dev/null; then
    echo "❌ ts-node 未安装，正在安装..."
    npm install -g ts-node
fi

# 检查项目依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装项目依赖..."
    yarn install
fi

# 构建项目
echo "🔨 构建项目..."
anchor build

# 运行发行脚本
echo "🚀 开始发行 DID..."
echo ""

# 设置环境变量 (如果需要)
export NODE_ENV=development

# 运行 TypeScript 脚本
npx ts-node scripts/mint-did-solana.ts

echo ""
echo "✅ 脚本执行完成!"