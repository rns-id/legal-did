#!/bin/bash

# 本地测试部署（使用 localnet）

echo "🧪 本地部署测试"
echo ""

# 1. 检查编译
echo "📦 步骤 1: 检查编译..."
if [ ! -f "target/deploy/legaldid.so" ]; then
  echo "  ❌ 程序文件不存在，运行 anchor build"
  anchor build
  if [ $? -ne 0 ]; then
    echo "  ❌ 编译失败"
    exit 1
  fi
fi
echo "  ✅ 程序文件存在"
echo ""

# 2. 检查 IDL
echo "📋 步骤 2: 验证 IDL..."
bash scripts/svm/verify-idl-seeds.sh
if [ $? -ne 0 ]; then
  echo "  ❌ IDL 验证失败"
  exit 1
fi
echo ""

# 3. 检查程序大小
echo "📏 步骤 3: 检查程序大小..."
PROGRAM_SIZE=$(wc -c < target/deploy/legaldid.so)
PROGRAM_SIZE_KB=$((PROGRAM_SIZE / 1024))
echo "  程序大小: ${PROGRAM_SIZE_KB} KB"

if [ $PROGRAM_SIZE_KB -gt 500 ]; then
  echo "  ⚠️  程序较大，可能需要优化"
else
  echo "  ✅ 程序大小合理"
fi
echo ""

# 4. 启动本地验证器（如果没有运行）
echo "🚀 步骤 4: 检查本地验证器..."
if ! solana cluster-version --url localhost &>/dev/null; then
  echo "  ⚠️  本地验证器未运行"
  echo "  提示: 运行 'solana-test-validator' 启动本地验证器"
  echo ""
  echo "  跳过本地部署测试（需要本地验证器）"
  echo ""
else
  echo "  ✅ 本地验证器正在运行"
  echo ""
  
  # 5. 部署到本地
  echo "📤 步骤 5: 部署到本地..."
  anchor deploy --provider.cluster localnet --program-name legaldid
  
  if [ $? -eq 0 ]; then
    echo "  ✅ 本地部署成功"
  else
    echo "  ❌ 本地部署失败"
    exit 1
  fi
  echo ""
fi

# 6. 总结
echo "✅ 本地测试完成！"
echo ""
echo "📝 测试结果:"
echo "  ✅ 编译成功"
echo "  ✅ IDL 验证通过（所有指令都有 PDA seeds）"
echo "  ✅ 程序大小: ${PROGRAM_SIZE_KB} KB"
echo ""
echo "🎯 下一步:"
echo "  1. 通过 Squads 多签升级 devnet 程序"
echo "  2. 在 Squads UI 测试 removeOperator"
echo "  3. 在 Squads UI 测试 addOperator"
echo ""
