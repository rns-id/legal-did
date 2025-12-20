#!/bin/bash

echo "🔍 验证路径更新..."
echo ""

# 检查目录结构
echo "📁 检查目录结构..."
if [ -d "tests/evm/legal-attestation" ]; then
    echo "✅ Legal Attestation测试目录存在: tests/evm/legal-attestation"
else
    echo "❌ Legal Attestation测试目录不存在: tests/evm/legal-attestation"
    exit 1
fi

if [ -d "tests/evm/legal-did" ]; then
    echo "✅ Legal DID测试目录存在: tests/evm/legal-did"
else
    echo "❌ Legal DID测试目录不存在: tests/evm/legal-did"
    exit 1
fi

if [ -d "tests/evm/LegalAttestation" ]; then
    echo "❌ 旧LegalAttestation目录仍然存在: tests/evm/LegalAttestation"
    exit 1
else
    echo "✅ 旧LegalAttestation目录已删除"
fi

# 检查测试文件
echo ""
echo "📋 检查Legal Attestation测试文件..."
legal_attestation_files=(
    "TaggedAttester.test.ts"
    "TaggedResolver.test.ts"
    "TaggedQuery.test.ts"
    "TaggedSchemaRegistrar.test.ts"
    "Integration.test.ts"
    "README.md"
)

for file in "${legal_attestation_files[@]}"; do
    if [ -f "tests/evm/legal-attestation/$file" ]; then
        echo "✅ Legal Attestation: $file 存在"
    else
        echo "❌ Legal Attestation: $file 不存在"
        exit 1
    fi
done

echo ""
echo "📋 检查Legal DID测试文件..."
legal_did_files=(
    "LegalDID.test.ts"
    "gas-analysis.test.ts"
    "README.md"
)

for file in "${legal_did_files[@]}"; do
    if [ -f "tests/evm/legal-did/$file" ]; then
        echo "✅ Legal DID: $file 存在"
    else
        echo "❌ Legal DID: $file 不存在"
        exit 1
    fi
done

# 检查package.json脚本
echo ""
echo "📦 检查package.json脚本..."
if grep -q "tests/evm/legal-attestation" package.json; then
    echo "✅ package.json包含新路径"
else
    echo "❌ package.json缺少新路径"
    exit 1
fi

if grep -q "tests/evm/LegalAttestation" package.json; then
    echo "❌ package.json仍包含旧路径"
    exit 1
else
    echo "✅ package.json已清除旧路径"
fi

# 检查测试运行脚本
echo ""
echo "🏃 检查测试运行脚本..."
if [ -f "scripts/evm/run-legal-attestation-tests.ts" ]; then
    if grep -q "tests/evm/legal-attestation" scripts/evm/run-legal-attestation-tests.ts; then
        echo "✅ 测试运行脚本包含新路径"
    else
        echo "❌ 测试运行脚本缺少新路径"
        exit 1
    fi
    
    if grep -q "tests/evm/LegalAttestation" scripts/evm/run-legal-attestation-tests.ts; then
        echo "❌ 测试运行脚本仍包含旧路径"
        exit 1
    else
        echo "✅ 测试运行脚本已清除旧路径"
    fi
else
    echo "⚠️  测试运行脚本不存在"
fi

# 测试编译
echo ""
echo "🔨 测试编译..."
compile_output=$(npx hardhat compile 2>&1)
compile_exit_code=$?

if [ $compile_exit_code -eq 0 ]; then
    echo "✅ 合约编译成功"
    if echo "$compile_output" | grep -q "Nothing to compile"; then
        echo "   📝 所有合约都是最新的"
    fi
else
    echo "❌ 合约编译失败"
    echo "$compile_output"
    exit 1
fi

echo ""
echo "==========================================="
echo "🎉 所有路径更新验证通过！"
echo "==========================================="
echo ""
echo "🚀 下一步操作:"
echo "1. 运行所有测试: npm run evm:test:all"
echo "2. 运行Legal DID测试: npm run evm:test:legal-did"
echo "3. 运行Legal Attestation测试: npm run evm:test:legal-attestation"
echo "4. 生成覆盖率报告: npm run evm:test:all:coverage"
echo "5. 运行完整测试套件: npm run evm:test:all:full"
echo ""