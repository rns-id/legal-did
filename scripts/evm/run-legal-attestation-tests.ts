import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
}

class LegalAttestationTestRunner {
  public results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log("🚀 开始运行 Legal Attestation 测试套件...\n");

    const testSuites = [
      {
        name: "TaggedAttester 测试",
        command: "npx hardhat test tests/evm/legal-attestation/TaggedAttester.test.ts"
      },
      {
        name: "TaggedResolver 测试",
        command: "npx hardhat test tests/evm/legal-attestation/TaggedResolver.test.ts"
      },
      {
        name: "TaggedQuery 测试",
        command: "npx hardhat test tests/evm/legal-attestation/TaggedQuery.test.ts"
      },
      {
        name: "TaggedSchemaRegistrar 测试",
        command: "npx hardhat test tests/evm/legal-attestation/TaggedSchemaRegistrar.test.ts"
      },
      {
        name: "Integration 测试",
        command: "npx hardhat test tests/evm/legal-attestation/Integration.test.ts"
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite.name, suite.command);
    }

    this.printSummary();
  }

  async runTestSuite(name: string, command: string): Promise<void> {
    console.log(`📋 运行 ${name}...`);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command);
      const duration = Date.now() - startTime;

      this.results.push({
        name,
        success: true,
        duration,
        output: stdout,
        error: stderr || undefined
      });

      console.log(`✅ ${name} 通过 (${duration}ms)`);
      
      // 提取测试统计信息
      const passMatch = stdout.match(/(\d+) passing/);
      const failMatch = stdout.match(/(\d+) failing/);
      
      if (passMatch) {
        console.log(`   📊 通过: ${passMatch[1]} 个测试`);
      }
      if (failMatch) {
        console.log(`   ❌ 失败: ${failMatch[1]} 个测试`);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: false,
        duration,
        output: error.stdout || "",
        error: error.stderr || error.message
      });

      console.log(`❌ ${name} 失败 (${duration}ms)`);
      console.log(`   错误: ${error.message}`);
    }

    console.log("");
  }

  printSummary(): void {
    console.log("==========================================");
    console.log("📊 测试结果汇总");
    console.log("==========================================");

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`总测试套件: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`总耗时: ${totalDuration}ms`);
    console.log("");

    // 详细结果
    this.results.forEach(result => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${result.name.padEnd(25)} ${result.duration}ms`);
    });

    // 失败详情
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log("\n❌ 失败详情:");
      console.log("==========================================");
      
      failedResults.forEach(result => {
        console.log(`\n📋 ${result.name}:`);
        if (result.error) {
          console.log(result.error);
        }
        if (result.output) {
          console.log(result.output);
        }
      });
    }

    console.log("==========================================");
    
    if (failedTests === 0) {
      console.log("🎉 所有测试都通过了！");
    } else {
      console.log(`⚠️  有 ${failedTests} 个测试套件失败，请检查上述错误信息。`);
    }
  }

  async runCoverageReport(): Promise<void> {
    console.log("\n📊 生成测试覆盖率报告...");
    
    try {
      const { stdout } = await execAsync(
        "npx hardhat coverage --testfiles \"tests/evm/legal-attestation/**/*.test.ts\""
      );
      
      console.log("✅ 覆盖率报告生成完成");
      console.log("📄 报告位置: coverage/index.html");
      
      // 提取覆盖率信息
      const coverageMatch = stdout.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        console.log(`📈 覆盖率统计:`);
        console.log(`   语句覆盖率: ${coverageMatch[1]}%`);
        console.log(`   分支覆盖率: ${coverageMatch[2]}%`);
        console.log(`   函数覆盖率: ${coverageMatch[3]}%`);
        console.log(`   行覆盖率: ${coverageMatch[4]}%`);
      }
      
    } catch (error: any) {
      console.log("❌ 覆盖率报告生成失败");
      console.log(error.message);
    }
  }

  async runGasReport(): Promise<void> {
    console.log("\n⛽ 生成Gas使用报告...");
    
    try {
      const { stdout } = await execAsync(
        "REPORT_GAS=true npx hardhat test tests/evm/legal-attestation/**/*.test.ts"
      );
      
      console.log("✅ Gas报告生成完成");
      
      // 提取Gas使用信息
      const gasLines = stdout.split('\n').filter(line => 
        line.includes('gas used') || line.includes('deployments')
      );
      
      if (gasLines.length > 0) {
        console.log("⛽ Gas使用统计:");
        gasLines.forEach(line => console.log(`   ${line.trim()}`));
      }
      
    } catch (error: any) {
      console.log("❌ Gas报告生成失败");
      console.log(error.message);
    }
  }
}

async function main() {
  const runner = new LegalAttestationTestRunner();
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const includeCoverage = args.includes('--coverage');
  const includeGas = args.includes('--gas');
  const onlyTest = args.find(arg => arg.startsWith('--only='))?.split('=')[1];

  try {
    if (onlyTest) {
      // 运行特定测试
      const testCommands: { [key: string]: string } = {
        'attester': 'npx hardhat test tests/evm/legal-attestation/TaggedAttester.test.ts',
        'resolver': 'npx hardhat test tests/evm/legal-attestation/TaggedResolver.test.ts',
        'query': 'npx hardhat test tests/evm/legal-attestation/TaggedQuery.test.ts',
        'registrar': 'npx hardhat test tests/evm/legal-attestation/TaggedSchemaRegistrar.test.ts',
        'integration': 'npx hardhat test tests/evm/legal-attestation/Integration.test.ts'
      };

      if (testCommands[onlyTest]) {
        await runner.runTestSuite(`${onlyTest} 测试`, testCommands[onlyTest]);
      } else {
        console.log(`❌ 未知的测试类型: ${onlyTest}`);
        console.log(`可用选项: ${Object.keys(testCommands).join(', ')}`);
        process.exit(1);
      }
    } else {
      // 运行所有测试
      await runner.runAllTests();
    }

    // 生成覆盖率报告
    if (includeCoverage) {
      await runner.runCoverageReport();
    }

    // 生成Gas报告
    if (includeGas) {
      await runner.runGasReport();
    }

    // 根据测试结果设置退出码
    const hasFailures = runner.results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    console.error("❌ 测试运行器发生错误:", error);
    process.exit(1);
  }
}

// 显示使用帮助
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Legal Attestation 测试运行器

用法:
  ts-node scripts/evm/run-legal-attestation-tests.ts [选项]

选项:
  --only=<test>     只运行特定测试 (attester|resolver|query|registrar|integration)
  --coverage        生成测试覆盖率报告
  --gas            生成Gas使用报告
  --help, -h       显示此帮助信息

示例:
  # 运行所有测试
  ts-node scripts/evm/run-legal-attestation-tests.ts

  # 只运行Attester测试
  ts-node scripts/evm/run-legal-attestation-tests.ts --only=attester

  # 运行所有测试并生成覆盖率报告
  ts-node scripts/evm/run-legal-attestation-tests.ts --coverage

  # 运行所有测试并生成Gas报告
  ts-node scripts/evm/run-legal-attestation-tests.ts --gas

  # 运行所有测试并生成所有报告
  ts-node scripts/evm/run-legal-attestation-tests.ts --coverage --gas
  `);
  process.exit(0);
}

main().catch(console.error);