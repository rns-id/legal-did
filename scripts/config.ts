/**
 * Legal DID 统一网络配置
 * 所有脚本应该从这里读取配置，而不是硬编码
 */

export interface NetworkConfig {
  rpcUrl: string;
  programId: string;
  explorerUrl: string;
}

/**
 * 网络配置
 * 支持从环境变量覆盖 RPC URL
 */
export const NETWORKS: Record<string, NetworkConfig> = {
  devnet: {
    rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
    programId: "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa",
    explorerUrl: "https://explorer.solana.com"
  },
  mainnet: {
    rpcUrl: process.env.SOLANA_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com",
    programId: "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa",
    explorerUrl: "https://explorer.solana.com"
  },
  // 本地测试网络（可选）
  localnet: {
    rpcUrl: "http://localhost:8899",
    programId: "BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa",
    explorerUrl: "https://explorer.solana.com"
  }
};

/**
 * 获取网络配置
 * @param network 网络名称 (devnet, mainnet, localnet)
 * @returns 网络配置对象
 * @throws 如果网络不支持
 */
export function getNetworkConfig(network: string = 'devnet'): NetworkConfig {
  const config = NETWORKS[network];
  
  if (!config) {
    throw new Error(
      `不支持的网络: ${network}. 支持的网络: ${Object.keys(NETWORKS).join(', ')}`
    );
  }
  
  return config;
}

/**
 * 获取浏览器链接
 * @param address 地址或交易哈希
 * @param network 网络名称
 * @param type 类型 (address 或 tx)
 * @returns 浏览器链接
 */
export function getExplorerLink(
  address: string,
  network: string = 'devnet',
  type: 'address' | 'tx' = 'address'
): string {
  const config = getNetworkConfig(network);
  const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
  return `${config.explorerUrl}/${type}/${address}${cluster}`;
}

/**
 * 验证网络名称
 * @param network 网络名称
 * @returns 是否有效
 */
export function isValidNetwork(network: string): boolean {
  return network in NETWORKS;
}

/**
 * 获取所有支持的网络
 * @returns 网络名称数组
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORKS);
}

// 导出常量
export const DEFAULT_NETWORK = 'devnet';
export const SUPPORTED_NETWORKS = getSupportedNetworks();
