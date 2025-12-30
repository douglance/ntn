/**
 * L2 deployment orchestration
 * Based on test-node.bash lines 492-513
 */

import { DEV_PRIVATE_KEY } from '../config/defaults.js';
import { composeRun } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import { cleanOutput, getLastLine, runWithCode } from '../utils/shell.js';
import { type AnyTrustConfig, setupAnyTrust } from './anytrust.js';
import type { InitContext } from './index.js';

/**
 * Write L2 chain configuration
 * Based on test-node.bash lines 494-500
 */
async function writeL2ChainConfig(ctx: InitContext): Promise<void> {
  if (!ctx.l2OwnerAddress) {
    throw new Error('L2 owner address not set');
  }

  const args = ['--l2owner', ctx.l2OwnerAddress, 'write-l2-chain-config'];

  if (ctx.flags.l2Anytrust) {
    logger.step('Writing L2 chain config (AnyTrust enabled)');
    args.push('--anytrust');
  } else {
    logger.step('Writing L2 chain config');
  }

  const result = await composeRun('scripts', args, { cwd: ctx.workDir });

  if (result.code !== 0) {
    throw new Error(`Failed to write L2 chain config: ${result.stderr}`);
  }
}

/**
 * Get sequencer address
 * Based on test-node.bash line 502
 */
async function getSequencerAddress(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-address', '--account', 'sequencer'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get sequencer address: ${result.stderr}`);
  }

  const address = cleanOutput(getLastLine(result.stdout));
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid sequencer address: ${address}`);
  }

  return address;
}

/**
 * Get L2 owner private key
 * Based on test-node.bash line 503
 */
async function getL2OwnerKey(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-private-key', '--account', 'l2owner'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get l2owner private key: ${result.stderr}`);
  }

  const key = cleanOutput(getLastLine(result.stdout));
  if (!key) {
    throw new Error('Invalid l2owner private key');
  }

  return key;
}

/**
 * Get WASM module root from sequencer image
 * Based on test-node.bash line 504
 */
async function getWasmRoot(ctx: InitContext): Promise<string> {
  const result = await composeRun(
    'sequencer',
    ['sh', '-c', 'cat /home/user/target/machines/latest/module-root.txt'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to get WASM module root: ${result.stderr}`);
  }

  const wasmRoot = cleanOutput(result.stdout);
  if (!wasmRoot) {
    throw new Error('Invalid WASM module root');
  }

  return wasmRoot;
}

/**
 * Deploy L2 rollup using rollupcreator
 * Based on test-node.bash lines 506-507
 */
async function deployRollup(ctx: InitContext): Promise<void> {
  if (!ctx.l2OwnerAddress || !ctx.l2OwnerKey || !ctx.sequencerAddress || !ctx.wasmRoot) {
    throw new Error('Missing required context values for rollup deployment');
  }

  logger.step('Deploying L2 chain');

  const env = {
    PARENT_CHAIN_RPC: 'http://geth:8545',
    DEPLOYER_PRIVKEY: ctx.l2OwnerKey,
    PARENT_CHAIN_ID: String(ctx.l1ChainId),
    CHILD_CHAIN_NAME: 'arb-dev-test',
    MAX_DATA_SIZE: '117964',
    OWNER_ADDRESS: ctx.l2OwnerAddress,
    WASM_MODULE_ROOT: ctx.wasmRoot,
    SEQUENCER_ADDRESS: ctx.sequencerAddress,
    AUTHORIZE_VALIDATORS: '10',
    CHILD_CHAIN_CONFIG_PATH: '/config/l2_chain_config.json',
    CHAIN_DEPLOYMENT_INFO: '/config/deployment.json',
    CHILD_CHAIN_INFO: '/config/deployed_chain_info.json',
  };

  // Build the env flags for docker compose run
  const envFlags = Object.entries(env)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ');

  const cmd = `docker compose run ${envFlags} rollupcreator create-rollup-testnode`;
  const result = await runWithCode(cmd, { cwd: ctx.workDir, timeout: 300000 }); // 5 min timeout

  if (result.code !== 0) {
    throw new Error(`Failed to deploy rollup: ${result.stderr}`);
  }

  logger.success('L2 rollup deployed');
}

/**
 * Process deployed chain info for use by nodes
 * Based on test-node.bash lines 508-512
 */
async function processDeployedChainInfo(ctx: InitContext): Promise<void> {
  logger.step('Processing deployed chain info');

  let jqCommand: string;

  if (ctx.flags.l2Timeboost) {
    // Add track-block-metadata-from field for timeboost
    jqCommand =
      'jq ".[]\\ |\\ .\\"track-block-metadata-from\\"=1\\ |\\ [.]" /config/deployed_chain_info.json > /config/l2_chain_info.json';
  } else {
    // Simple array transformation
    jqCommand = 'jq [.[]] /config/deployed_chain_info.json > /config/l2_chain_info.json';
  }

  const result = await composeRun('rollupcreator', ['sh', '-c', jqCommand], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to process deployed chain info: ${result.stderr}`);
  }
}

/**
 * Deploy the L2 chain
 * Returns AnyTrust config if enabled, for use in node configuration
 */
export async function deployL2(ctx: InitContext): Promise<AnyTrustConfig | undefined> {
  // Get required addresses and keys
  ctx.sequencerAddress = await getSequencerAddress(ctx);
  logger.debug(`Sequencer address: ${ctx.sequencerAddress}`);

  ctx.l2OwnerKey = await getL2OwnerKey(ctx);
  logger.debug('L2 owner key retrieved');

  ctx.wasmRoot = await getWasmRoot(ctx);
  logger.debug(`WASM root: ${ctx.wasmRoot}`);

  // Write L2 chain config
  await writeL2ChainConfig(ctx);

  // Deploy rollup
  await deployRollup(ctx);

  // Process chain info
  await processDeployedChainInfo(ctx);

  // Setup AnyTrust if enabled
  const anyTrustConfig = await setupAnyTrust(ctx);

  logger.success('L2 deployment complete');

  return anyTrustConfig;
}
