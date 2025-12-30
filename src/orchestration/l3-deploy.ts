/**
 * L3 chain deployment orchestration
 * Based on test-node.bash lines 613-696
 */

import { composeRun, composeUp } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import { cleanOutput, getLastLine, runWithCode } from '../utils/shell.js';
import type { InitContext } from './index.js';

/**
 * L3 deployment configuration state
 */
interface L3DeployConfig {
  /** L3 owner address */
  l3OwnerAddress: string;
  /** L3 owner private key */
  l3OwnerKey: string;
  /** L3 sequencer address */
  l3SequencerAddress: string;
  /** Native fee token address (if custom fee token enabled) */
  nativeTokenAddress?: string;
  /** Fee token pricer address (if enabled) */
  feeTokenPricerAddress?: string;
}

/**
 * Fund L3 user accounts
 * Based on test-node.bash lines 614-617
 */
async function fundL3Users(ctx: InitContext): Promise<void> {
  logger.step('Funding L3 users');

  const accounts = ['validator', 'l3owner', 'l3sequencer'];

  for (const account of accounts) {
    logger.debug(`Funding ${account}`);
    const result = await composeRun(
      'scripts',
      ['send-l2', '--ethamount', '1000', '--to', account, '--wait'],
      { cwd: ctx.workDir },
    );

    if (result.code !== 0) {
      throw new Error(`Failed to fund ${account}: ${result.stderr}`);
    }
  }
}

/**
 * Fund L2 deployers for token bridge deployment
 * Based on test-node.bash lines 619-621
 */
async function fundL2Deployers(ctx: InitContext): Promise<void> {
  logger.step('Funding L2 deployers');

  // Fund on L1
  const l1Result = await composeRun(
    'scripts',
    ['send-l1', '--ethamount', '100', '--to', 'user_token_bridge_deployer', '--wait'],
    { cwd: ctx.workDir },
  );

  if (l1Result.code !== 0) {
    throw new Error(`Failed to fund deployer on L1: ${l1Result.stderr}`);
  }

  // Fund on L2
  const l2Result = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '100', '--to', 'user_token_bridge_deployer', '--wait'],
    { cwd: ctx.workDir },
  );

  if (l2Result.code !== 0) {
    throw new Error(`Failed to fund deployer on L2: ${l2Result.stderr}`);
  }
}

/**
 * Fund token deployer for custom fee token
 * Based on test-node.bash lines 623-625
 */
async function fundTokenDeployer(ctx: InitContext): Promise<void> {
  logger.step('Funding token deployer');

  // Fund on L1
  const l1Result = await composeRun(
    'scripts',
    ['send-l1', '--ethamount', '100', '--to', 'user_fee_token_deployer', '--wait'],
    { cwd: ctx.workDir },
  );

  if (l1Result.code !== 0) {
    throw new Error(`Failed to fund token deployer on L1: ${l1Result.stderr}`);
  }

  // Fund on L2
  const l2Result = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '100', '--to', 'user_fee_token_deployer', '--wait'],
    { cwd: ctx.workDir },
  );

  if (l2Result.code !== 0) {
    throw new Error(`Failed to fund token deployer on L2: ${l2Result.stderr}`);
  }
}

/**
 * Get L3 owner address
 * Based on test-node.bash line 628
 */
async function getL3OwnerAddress(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-address', '--account', 'l3owner'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get l3owner address: ${result.stderr}`);
  }

  const address = cleanOutput(getLastLine(result.stdout));
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid l3owner address: ${address}`);
  }

  return address;
}

/**
 * Get L3 owner private key
 * Based on test-node.bash line 647
 */
async function getL3OwnerKey(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-private-key', '--account', 'l3owner'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get l3owner private key: ${result.stderr}`);
  }

  const key = cleanOutput(getLastLine(result.stdout));
  if (!key) {
    throw new Error('Invalid l3owner private key');
  }

  return key;
}

/**
 * Get L3 sequencer address
 * Based on test-node.bash line 648
 */
async function getL3SequencerAddress(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-address', '--account', 'l3sequencer'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get l3sequencer address: ${result.stderr}`);
  }

  const address = cleanOutput(getLastLine(result.stdout));
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid l3sequencer address: ${address}`);
  }

  return address;
}

/**
 * Write L3 chain configuration
 * Based on test-node.bash line 630
 */
async function writeL3ChainConfig(ctx: InitContext, l3OwnerAddress: string): Promise<void> {
  logger.step('Writing L3 chain config');

  const result = await composeRun(
    'scripts',
    ['--l2owner', l3OwnerAddress, 'write-l3-chain-config'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to write L3 chain config: ${result.stderr}`);
  }
}

/**
 * Deploy custom fee token if enabled
 * Based on test-node.bash lines 633-644
 */
async function deployCustomFeeToken(ctx: InitContext): Promise<{
  nativeTokenAddress?: string;
  feeTokenPricerAddress?: string;
}> {
  if (!ctx.flags.l3FeeToken) {
    return {};
  }

  logger.step('Deploying custom fee token');

  // Create ERC20 token
  const createArgs = [
    'create-erc20',
    '--deployer',
    'user_fee_token_deployer',
    '--bridgeable',
    String(ctx.flags.tokenbridge),
    '--decimals',
    String(ctx.flags.l3FeeTokenDecimals),
  ];

  const createResult = await composeRun('scripts', createArgs, {
    cwd: ctx.workDir,
    timeout: 120000,
  });

  if (createResult.code !== 0) {
    throw new Error(`Failed to create fee token: ${createResult.stderr}`);
  }

  // Extract token address
  const lastLine = getLastLine(createResult.stdout);
  const words = lastLine.split(/\s+/);
  const nativeTokenAddress = cleanOutput(words[words.length - 1] || '');

  if (!nativeTokenAddress || !nativeTokenAddress.startsWith('0x')) {
    throw new Error(`Invalid fee token address: ${nativeTokenAddress}`);
  }

  logger.debug(`Native token address: ${nativeTokenAddress}`);

  // Transfer tokens to l3owner
  const transferL3OwnerResult = await composeRun(
    'scripts',
    [
      'transfer-erc20',
      '--token',
      nativeTokenAddress,
      '--amount',
      '10000',
      '--from',
      'user_fee_token_deployer',
      '--to',
      'l3owner',
    ],
    { cwd: ctx.workDir },
  );

  if (transferL3OwnerResult.code !== 0) {
    throw new Error(`Failed to transfer tokens to l3owner: ${transferL3OwnerResult.stderr}`);
  }

  // Transfer tokens to token bridge deployer
  const transferBridgeResult = await composeRun(
    'scripts',
    [
      'transfer-erc20',
      '--token',
      nativeTokenAddress,
      '--amount',
      '10000',
      '--from',
      'user_fee_token_deployer',
      '--to',
      'user_token_bridge_deployer',
    ],
    { cwd: ctx.workDir },
  );

  if (transferBridgeResult.code !== 0) {
    throw new Error(`Failed to transfer tokens to bridge deployer: ${transferBridgeResult.stderr}`);
  }

  // Deploy fee token pricer if enabled
  let feeTokenPricerAddress: string | undefined;
  if (ctx.flags.l3FeeTokenPricer) {
    logger.step('Deploying fee token pricer');

    const pricerResult = await composeRun(
      'scripts',
      ['create-fee-token-pricer', '--deployer', 'user_fee_token_deployer'],
      { cwd: ctx.workDir, timeout: 120000 },
    );

    if (pricerResult.code !== 0) {
      throw new Error(`Failed to deploy fee token pricer: ${pricerResult.stderr}`);
    }

    const pricerLastLine = getLastLine(pricerResult.stdout);
    const pricerWords = pricerLastLine.split(/\s+/);
    feeTokenPricerAddress = cleanOutput(pricerWords[pricerWords.length - 1] || '');

    if (!feeTokenPricerAddress || !feeTokenPricerAddress.startsWith('0x')) {
      throw new Error(`Invalid fee token pricer address: ${feeTokenPricerAddress}`);
    }

    logger.debug(`Fee token pricer address: ${feeTokenPricerAddress}`);
  }

  return { nativeTokenAddress, feeTokenPricerAddress };
}

/**
 * Deploy L3 rollup contracts
 * Based on test-node.bash line 650
 */
async function deployL3Rollup(ctx: InitContext, config: L3DeployConfig): Promise<void> {
  logger.step('Deploying L3 rollup');

  const envVars: Record<string, string> = {
    DEPLOYER_PRIVKEY: config.l3OwnerKey,
    PARENT_CHAIN_RPC: 'http://sequencer:8547',
    PARENT_CHAIN_ID: '412346',
    CHILD_CHAIN_NAME: 'orbit-dev-test',
    MAX_DATA_SIZE: '104857',
    OWNER_ADDRESS: config.l3OwnerAddress,
    WASM_MODULE_ROOT: ctx.wasmRoot || '',
    SEQUENCER_ADDRESS: config.l3SequencerAddress,
    AUTHORIZE_VALIDATORS: '10',
    CHILD_CHAIN_CONFIG_PATH: '/config/l3_chain_config.json',
    CHAIN_DEPLOYMENT_INFO: '/config/l3deployment.json',
    CHILD_CHAIN_INFO: '/config/deployed_l3_chain_info.json',
  };

  // Add fee token env vars if custom fee token
  if (config.nativeTokenAddress) {
    envVars.FEE_TOKEN_ADDRESS = config.nativeTokenAddress;
  }
  if (config.feeTokenPricerAddress) {
    envVars.FEE_TOKEN_PRICER_ADDRESS = config.feeTokenPricerAddress;
  }

  // Build env flags
  const envFlags = Object.entries(envVars)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ');

  const cmd = `docker compose run ${envFlags} rollupcreator create-rollup-testnode`;
  const result = await runWithCode(cmd, { cwd: ctx.workDir, timeout: 300000 });

  if (result.code !== 0) {
    throw new Error(`Failed to deploy L3 rollup: ${result.stderr}`);
  }

  // Process chain info
  const jqResult = await composeRun(
    'rollupcreator',
    ['sh', '-c', 'jq [.[]] /config/deployed_l3_chain_info.json > /config/l3_chain_info.json'],
    { cwd: ctx.workDir },
  );

  if (jqResult.code !== 0) {
    throw new Error(`Failed to process L3 chain info: ${jqResult.stderr}`);
  }

  logger.success('L3 rollup deployed');
}

/**
 * Start L3 node
 * Based on test-node.bash line 654
 */
async function startL3Node(ctx: InitContext): Promise<void> {
  logger.step('Starting L3 node');

  const exitCode = await composeUp(['l3node', 'sequencer'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start L3 node');
  }
}

/**
 * Get L2 WETH address from l1l2_network.json if L1-L2 token bridge was deployed
 */
async function getL2WethAddress(ctx: InitContext): Promise<string> {
  if (!ctx.flags.tokenbridge) {
    return '';
  }

  const wethResult = await composeRun('tokenbridge', ['sh', '-c', 'cat l1l2_network.json'], {
    cwd: ctx.workDir,
  });

  if (wethResult.code !== 0) {
    return '';
  }

  try {
    const network = JSON.parse(wethResult.stdout);
    return network.l2Network?.tokenBridge?.childWeth || '';
  } catch {
    logger.warn('Failed to parse l1l2_network.json for L2 WETH');
    return '';
  }
}

/**
 * Transfer L3 chain ownership to UpgradeExecutor
 */
async function transferL3ChainOwnership(ctx: InitContext): Promise<void> {
  logger.step('Setting L3 UpgradeExecutor as chain owner');

  const creatorResult = await composeRun('tokenbridge', ['sh', '-c', 'cat l2l3_network.json'], {
    cwd: ctx.workDir,
  });

  if (creatorResult.code !== 0) {
    logger.warn('Failed to read l2l3_network.json');
    return;
  }

  try {
    const network = JSON.parse(creatorResult.stdout);
    const tokenBridgeCreator = network.l1TokenBridgeCreator || '';

    if (!tokenBridgeCreator) {
      logger.warn('No token bridge creator found in l2l3_network.json');
      return;
    }

    const transferResult = await composeRun(
      'scripts',
      ['transfer-l3-chain-ownership', '--creator', tokenBridgeCreator],
      { cwd: ctx.workDir },
    );

    if (transferResult.code !== 0) {
      logger.warn(`Failed to transfer L3 chain ownership: ${transferResult.stderr}`);
    }
  } catch {
    logger.warn('Failed to parse l2l3_network.json for chain ownership transfer');
  }
}

/**
 * Deploy L2-L3 token bridge
 * Based on test-node.bash lines 656-673
 */
async function deployL3TokenBridge(ctx: InitContext, l3OwnerKey: string): Promise<void> {
  if (!ctx.flags.l3TokenBridge) {
    return;
  }

  logger.step('Deploying L2-L3 token bridge');

  // Generate deployer key
  const deployerKeyResult = await runWithCode(
    "printf '%s' 'user_token_bridge_deployer' | openssl dgst -sha256 | sed 's/^.*= //'",
    { cwd: ctx.workDir },
  );
  const deployerKey = cleanOutput(deployerKeyResult.stdout);

  // Get rollup address
  const rollupResult = await composeRun(
    'poster',
    [
      'sh',
      '-c',
      "jq -r '.[0].rollup.rollup' /config/deployed_l3_chain_info.json | tail -n 1 | tr -d '\\r\\n'",
    ],
    { cwd: ctx.workDir },
  );

  if (rollupResult.code !== 0) {
    throw new Error(`Failed to get L3 rollup address: ${rollupResult.stderr}`);
  }

  const rollupAddress = cleanOutput(rollupResult.stdout);
  const l2Weth = await getL2WethAddress(ctx);

  // Deploy token bridge
  const envFlags = [
    `-e PARENT_WETH_OVERRIDE=${l2Weth}`,
    `-e ROLLUP_OWNER_KEY=${l3OwnerKey}`,
    `-e ROLLUP_ADDRESS=${rollupAddress}`,
    '-e PARENT_RPC=http://sequencer:8547',
    `-e PARENT_KEY=${deployerKey}`,
    '-e CHILD_RPC=http://l3node:3347',
    `-e CHILD_KEY=${deployerKey}`,
  ].join(' ');

  const deployResult = await runWithCode(
    `docker compose run ${envFlags} tokenbridge deploy:local:token-bridge`,
    { cwd: ctx.workDir, timeout: 300000 },
  );

  if (deployResult.code !== 0) {
    throw new Error(`Failed to deploy L3 token bridge: ${deployResult.stderr}`);
  }

  // Copy network.json
  const copyResult = await composeRun(
    'tokenbridge',
    ['sh', '-c', 'cat network.json && cp network.json l2l3_network.json'],
    { cwd: ctx.workDir },
  );

  if (copyResult.code !== 0) {
    logger.warn('Failed to copy L3 token bridge network files');
  }

  // Transfer L3 chain ownership to UpgradeExecutor
  await transferL3ChainOwnership(ctx);

  logger.success('L3 token bridge deployed');
}

/**
 * Fund L3 accounts
 * Based on test-node.bash lines 676-683
 */
async function fundL3Accounts(ctx: InitContext, nativeTokenAddress?: string): Promise<void> {
  logger.step('Funding L3 accounts');

  if (nativeTokenAddress) {
    // Bridge native token to L3
    const bridgeResult = await composeRun(
      'scripts',
      [
        'bridge-native-token-to-l3',
        '--amount',
        '5000',
        '--from',
        'user_fee_token_deployer',
        '--wait',
      ],
      { cwd: ctx.workDir, timeout: 120000 },
    );

    if (bridgeResult.code !== 0) {
      throw new Error(`Failed to bridge native token to L3: ${bridgeResult.stderr}`);
    }

    // Send L3 ETH
    const sendResult = await composeRun(
      'scripts',
      ['send-l3', '--ethamount', '100', '--from', 'user_fee_token_deployer', '--wait'],
      { cwd: ctx.workDir },
    );

    if (sendResult.code !== 0) {
      throw new Error(`Failed to send L3 from fee token deployer: ${sendResult.stderr}`);
    }
  } else {
    // Bridge ETH to L3
    const bridgeResult = await composeRun(
      'scripts',
      ['bridge-to-l3', '--ethamount', '50000', '--wait'],
      { cwd: ctx.workDir, timeout: 120000 },
    );

    if (bridgeResult.code !== 0) {
      throw new Error(`Failed to bridge to L3: ${bridgeResult.stderr}`);
    }
  }

  // Send to l3owner
  const sendResult = await composeRun(
    'scripts',
    ['send-l3', '--ethamount', '10', '--to', 'l3owner', '--wait'],
    { cwd: ctx.workDir },
  );

  if (sendResult.code !== 0) {
    throw new Error(`Failed to fund l3owner: ${sendResult.stderr}`);
  }
}

/**
 * Deploy CacheManager on L3
 * Based on test-node.bash lines 685-686
 */
async function deployCacheManagerL3(ctx: InitContext, l3OwnerKey: string): Promise<void> {
  logger.step('Deploying CacheManager on L3');

  const envFlags = `-e CHILD_CHAIN_RPC=http://l3node:3347 -e CHAIN_OWNER_PRIVKEY=${l3OwnerKey}`;

  const result = await runWithCode(
    `docker compose run ${envFlags} rollupcreator deploy-cachemanager-testnode`,
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    logger.warn(`L3 CacheManager deployment failed: ${result.stderr}`);
  }
}

/**
 * Deploy Stylus Deployer on L3
 * Based on test-node.bash lines 688-689
 */
async function deployStylusDeployerL3(ctx: InitContext): Promise<void> {
  logger.step('Deploying Stylus Deployer on L3');

  const result = await composeRun(
    'scripts',
    ['create-stylus-deployer', '--deployer', 'l3owner', '--l3'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    logger.warn(`L3 Stylus deployer deployment failed: ${result.stderr}`);
  }
}

/**
 * Deploy L3 chain
 * Only runs when --l3node flag is set
 *
 * Based on test-node.bash lines 613-696:
 * - Fund L3 users
 * - Fund L2/L3 deployers
 * - Write L3 chain config
 * - Deploy custom fee token if enabled
 * - Deploy L3 rollup
 * - Start L3 node
 * - Deploy L3 token bridge if enabled
 * - Fund L3 accounts
 * - Deploy CacheManager
 * - Deploy Stylus Deployer
 */
export async function deployL3(ctx: InitContext): Promise<void> {
  if (!ctx.flags.l3node) {
    logger.debug('Skipping L3 deployment (not enabled)');
    return;
  }

  logger.step('Deploying L3 chain');

  // Fund users
  await fundL3Users(ctx);
  await fundL2Deployers(ctx);
  await fundTokenDeployer(ctx);

  // Get addresses and keys
  const l3OwnerAddress = await getL3OwnerAddress(ctx);
  logger.debug(`L3 owner address: ${l3OwnerAddress}`);

  // Write L3 chain config
  await writeL3ChainConfig(ctx, l3OwnerAddress);

  // Deploy custom fee token if enabled
  const { nativeTokenAddress, feeTokenPricerAddress } = await deployCustomFeeToken(ctx);

  // Get remaining config
  const l3OwnerKey = await getL3OwnerKey(ctx);
  const l3SequencerAddress = await getL3SequencerAddress(ctx);

  const config: L3DeployConfig = {
    l3OwnerAddress,
    l3OwnerKey,
    l3SequencerAddress,
    nativeTokenAddress,
    feeTokenPricerAddress,
  };

  // Deploy L3 rollup
  await deployL3Rollup(ctx, config);

  // Start L3 node
  await startL3Node(ctx);

  // Deploy L3 token bridge if enabled
  await deployL3TokenBridge(ctx, l3OwnerKey);

  // Fund L3 accounts
  await fundL3Accounts(ctx, nativeTokenAddress);

  // Deploy post-deploy contracts
  await deployCacheManagerL3(ctx, l3OwnerKey);
  await deployStylusDeployerL3(ctx);

  logger.success('L3 deployment complete');
}
