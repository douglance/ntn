/**
 * L2 node configuration orchestration
 * Based on test-node.bash lines 546-560
 */

import { DEV_PRIVATE_KEY } from '../config/defaults.js';
import { calculateInitialSequencerNodes } from '../config/services.js';
import { composeRun, composeUp } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import type { AnyTrustConfig } from './anytrust.js';
import { buildAnyTrustConfigArgs } from './anytrust.js';
import type { InitContext } from './index.js';
import { deployL3 } from './l3-deploy.js';
import { setupTimeboost } from './timeboost.js';

/**
 * Build config arguments based on flags
 * Based on test-node.bash lines 516-549
 */
function buildConfigArgs(ctx: InitContext, anyTrustConfig?: AnyTrustConfig): string[] {
  const args: string[] = [];

  // Simple mode (bash line 550-552)
  if (ctx.flags.simple) {
    args.push('--simple');
  }

  // AnyTrust config line (bash lines 516-537)
  if (ctx.flags.l2Anytrust && anyTrustConfig) {
    args.push(...buildAnyTrustConfigArgs(anyTrustConfig));
  }

  // Timeboost config line (bash lines 547-549)
  if (ctx.flags.l2Timeboost) {
    args.push('--timeboost');
  }

  return args;
}

/**
 * Write node configurations
 * Based on test-node.bash lines 550-556
 */
async function writeNodeConfigs(ctx: InitContext, anyTrustConfig?: AnyTrustConfig): Promise<void> {
  logger.step('Writing node configs');

  const baseArgs = ['write-config'];
  const configArgs = buildConfigArgs(ctx, anyTrustConfig);

  const result = await composeRun('scripts', [...baseArgs, ...configArgs], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to write node configs: ${result.stderr}`);
  }
}

/**
 * Initialize redis for non-simple mode
 * Based on test-node.bash lines 557-559
 */
async function initializeRedis(ctx: InitContext): Promise<void> {
  if (ctx.flags.simple) {
    logger.debug('Skipping redis init (simple mode)');
    return;
  }

  logger.step('Initializing redis');

  // Start redis
  const upExitCode = await composeUp(['redis'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (upExitCode !== 0) {
    throw new Error('Failed to start redis');
  }

  // Initialize redis with redundancy config
  const result = await composeRun(
    'scripts',
    ['redis-init', '--redundancy', String(ctx.flags.redundantsequencers)],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to initialize redis: ${result.stderr}`);
  }

  logger.success('Redis initialized');
}

/**
 * Start initial sequencer nodes and fund accounts
 * Based on test-node.bash lines 562-565
 */
async function startSequencersAndFund(ctx: InitContext): Promise<void> {
  logger.step('Starting initial sequencer nodes');

  const initialNodes = calculateInitialSequencerNodes({
    redundantsequencers: ctx.flags.redundantsequencers,
  });

  const exitCode = await composeUp(initialNodes, {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start sequencer nodes');
  }

  logger.step('Funding L2 funnel and dev key');

  // Bridge funds to L2
  const bridgeResult = await composeRun(
    'scripts',
    ['bridge-funds', '--ethamount', '100000', '--wait'],
    { cwd: ctx.workDir, timeout: 120000 },
  );

  if (bridgeResult.code !== 0) {
    throw new Error(`Failed to bridge funds: ${bridgeResult.stderr}`);
  }

  // Send ETH to l2owner on L2
  const sendResult = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '100', '--to', 'l2owner', '--wait'],
    { cwd: ctx.workDir },
  );

  if (sendResult.code !== 0) {
    throw new Error(`Failed to fund l2owner on L2: ${sendResult.stderr}`);
  }

  logger.success('Sequencers started and accounts funded');
}

/**
 * Deploy token bridge if enabled
 * Based on test-node.bash lines 588-594
 */
async function deployTokenBridge(ctx: InitContext): Promise<void> {
  if (!ctx.flags.tokenbridge) {
    return;
  }

  if (!ctx.l2OwnerKey) {
    throw new Error('L2 owner key not available for token bridge deployment');
  }

  logger.step('Deploying L1-L2 token bridge');

  // Get rollup address
  const rollupResult = await composeRun(
    'poster',
    [
      'sh',
      '-c',
      "jq -r '.[0].rollup.rollup' /config/deployed_chain_info.json | tail -n 1 | tr -d '\\r\\n'",
    ],
    { cwd: ctx.workDir },
  );

  if (rollupResult.code !== 0) {
    throw new Error(`Failed to get rollup address: ${rollupResult.stderr}`);
  }

  const rollupAddress = rollupResult.stdout.trim();

  // Sleep to avoid random deploy failures (as noted in bash script)
  logger.debug('Waiting before token bridge deploy...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Deploy token bridge
  const envFlags = [
    `-e ROLLUP_OWNER_KEY=${ctx.l2OwnerKey}`,
    `-e ROLLUP_ADDRESS=${rollupAddress}`,
    `-e PARENT_KEY=${DEV_PRIVATE_KEY}`,
    '-e PARENT_RPC=http://geth:8545',
    `-e CHILD_KEY=${DEV_PRIVATE_KEY}`,
    '-e CHILD_RPC=http://sequencer:8547',
  ].join(' ');

  const { runWithCode } = await import('../utils/shell.js');
  const deployResult = await runWithCode(
    `docker compose run ${envFlags} tokenbridge deploy:local:token-bridge`,
    { cwd: ctx.workDir, timeout: 300000 },
  );

  if (deployResult.code !== 0) {
    throw new Error(`Failed to deploy token bridge: ${deployResult.stderr}`);
  }

  // Copy network.json files
  const copyResult = await composeRun(
    'tokenbridge',
    [
      'sh',
      '-c',
      'cat network.json && cp network.json l1l2_network.json && cp network.json localNetwork.json',
    ],
    { cwd: ctx.workDir },
  );

  if (copyResult.code !== 0) {
    logger.warn('Failed to copy token bridge network files');
  }

  logger.success('Token bridge deployed');
}

/**
 * Deploy CacheManager and other post-deploy contracts
 * Based on test-node.bash lines 596-605
 */
async function deployPostDeployContracts(ctx: InitContext): Promise<void> {
  if (!ctx.l2OwnerKey) {
    throw new Error('L2 owner key not available');
  }

  logger.step('Deploying CacheManager on L2');

  const envFlags = `-e CHILD_CHAIN_RPC=http://sequencer:8547 -e CHAIN_OWNER_PRIVKEY=${ctx.l2OwnerKey}`;

  const { runWithCode } = await import('../utils/shell.js');
  const cacheResult = await runWithCode(
    `docker compose run ${envFlags} rollupcreator deploy-cachemanager-testnode`,
    { cwd: ctx.workDir },
  );

  if (cacheResult.code !== 0) {
    logger.warn(`CacheManager deployment failed: ${cacheResult.stderr}`);
  }

  logger.step('Deploying Stylus Deployer on L2');

  const stylusResult = await composeRun(
    'scripts',
    ['create-stylus-deployer', '--deployer', 'l2owner'],
    { cwd: ctx.workDir },
  );

  if (stylusResult.code !== 0) {
    logger.warn(`Stylus deployer deployment failed: ${stylusResult.stderr}`);
  }

  // Gas estimation workaround
  logger.step('Applying gas estimation workaround');

  await composeRun(
    'scripts',
    [
      'send-l1',
      '--ethamount',
      '1',
      '--to',
      'address_0x0000000000000000000000000000000000000000',
      '--wait',
    ],
    { cwd: ctx.workDir },
  );

  await composeRun(
    'scripts',
    [
      'send-l2',
      '--ethamount',
      '1',
      '--to',
      'address_0x0000000000000000000000000000000000000000',
      '--wait',
    ],
    { cwd: ctx.workDir },
  );
}

/**
 * Configure L2 nodes and complete init
 * @param ctx - Init context
 * @param anyTrustConfig - AnyTrust configuration (if enabled)
 */
export async function configureL2Nodes(
  ctx: InitContext,
  anyTrustConfig?: AnyTrustConfig,
): Promise<void> {
  await writeNodeConfigs(ctx, anyTrustConfig);
  await initializeRedis(ctx);
  await startSequencersAndFund(ctx);
  await setupTimeboost(ctx);
  await deployTokenBridge(ctx);
  await deployPostDeployContracts(ctx);
  // Note: L2 traffic setup is handled by traffic.ts based on --l2-traffic flag
  await deployL3(ctx);

  logger.success('L2 configuration complete');
}
