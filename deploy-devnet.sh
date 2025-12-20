#!/bin/bash

# 部署到 devnet 并验证的脚本

echo "=========================================="
echo "部署 RNS DID Core 到 Devnet"
echo "=========================================="

# 1. 检查网络配置
echo "1. 检查当前网络配置..."
solana config get

# 2. 检查余额
echo ""
echo "2. 检查钱包余额..."
BALANCE=$(solana balance | awk '{print $1}')
echo "当前余额: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  余额不足！需要至少 2 SOL 用于部署"
    echo "请访问以下水龙头获取 devnet SOL:"
    echo "  - https://faucet.solana.com"
    echo "  - https://solfaucet.com"
    echo ""
    echo "你的钱包地址: $(solana address)"
    exit 1
fi

# 3. 构建程序
echo ""
echo "3. 构建程序..."
anchor build

# 4. 部署程序
echo ""
echo "4. 部署到 devnet..."
anchor deploy --provider.cluster devnet

# 5. 获取程序 ID
PROGRAM_ID=$(solana address -k target/deploy/rnsdid_core-keypair.json)
echo ""
echo "程序已部署！"
echo "程序 ID: $PROGRAM_ID"

# 6. 验证程序
echo ""
echo "5. 验证程序..."
anchor verify $PROGRAM_ID

echo ""
echo "=========================================="
echo "✅ 部署和验证完成！"
echo "=========================================="
echo "程序 ID: $PROGRAM_ID"
echo "浏览器查看: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "=========================================="
