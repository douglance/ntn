/**
 * Timeboost Express Lane Auction setup orchestration
 * Based on test-node.bash lines 568-586
 */

import { composeRun } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import { cleanOutput, getLastLine, runWithCode } from '../utils/shell.js';
import type { InitContext } from './index.js';

/**
 * Timeboost configuration state
 */
export interface TimeboostConfig {
  /** Address of the bidding ERC20 token */
  biddingTokenAddress: string;
  /** Address of the auction contract */
  auctionContractAddress: string;
  /** Address of the auctioneer account */
  auctioneerAddress: string;
}

/**
 * Fund the auctioneer account
 * Based on test-node.bash line 569
 */
async function fundAuctioneer(ctx: InitContext): Promise<void> {
  logger.step('Funding auctioneer account');

  const result = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '100', '--to', 'auctioneer', '--wait'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to fund auctioneer: ${result.stderr}`);
  }
}

/**
 * Deploy bidding ERC20 token
 * Based on test-node.bash line 570
 */
async function deployBiddingToken(ctx: InitContext): Promise<string> {
  logger.step('Deploying bidding token');

  const result = await composeRun('scripts', ['create-erc20', '--deployer', 'auctioneer'], {
    cwd: ctx.workDir,
    timeout: 120000,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to deploy bidding token: ${result.stderr}`);
  }

  // Extract token address from output (last word of last line)
  const lastLine = getLastLine(result.stdout);
  const words = lastLine.split(/\s+/);
  const tokenAddress = cleanOutput(words[words.length - 1] || '');

  if (!tokenAddress || !tokenAddress.startsWith('0x')) {
    throw new Error(`Invalid bidding token address: ${tokenAddress}`);
  }

  logger.debug(`Bidding token address: ${tokenAddress}`);
  return tokenAddress;
}

/**
 * Deploy express lane auction contract
 * Based on test-node.bash line 571
 */
async function deployAuctionContract(
  ctx: InitContext,
  biddingTokenAddress: string,
): Promise<string> {
  logger.step('Deploying express lane auction contract');

  const result = await composeRun(
    'scripts',
    ['deploy-express-lane-auction', '--bidding-token', biddingTokenAddress],
    { cwd: ctx.workDir, timeout: 120000 },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to deploy auction contract: ${result.stderr}`);
  }

  // Extract auction contract address from output (last word of last line)
  const lastLine = getLastLine(result.stdout);
  const words = lastLine.split(/\s+/);
  const auctionAddress = cleanOutput(words[words.length - 1] || '');

  if (!auctionAddress || !auctionAddress.startsWith('0x')) {
    throw new Error(`Invalid auction contract address: ${auctionAddress}`);
  }

  logger.debug(`Auction contract address: ${auctionAddress}`);
  return auctionAddress;
}

/**
 * Get auctioneer address
 * Based on test-node.bash line 572
 */
async function getAuctioneerAddress(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-address', '--account', 'auctioneer'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get auctioneer address: ${result.stderr}`);
  }

  const address = cleanOutput(getLastLine(result.stdout));
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid auctioneer address: ${address}`);
  }

  return address;
}

/**
 * Write timeboost configuration files
 * Based on test-node.bash line 575
 */
async function writeTimeboostConfigs(
  ctx: InitContext,
  auctionContractAddress: string,
): Promise<void> {
  logger.step('Writing timeboost configuration');

  const result = await composeRun(
    'scripts',
    ['write-timeboost-configs', '--auction-contract', auctionContractAddress],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to write timeboost configs: ${result.stderr}`);
  }
}

/**
 * Fix auctioneer data directory permissions
 * Based on test-node.bash line 576
 */
async function fixAuctioneerPermissions(ctx: InitContext): Promise<void> {
  logger.step('Fixing auctioneer permissions');

  const result = await composeRun(
    'timeboost-auctioneer',
    ['sh', '-c', 'chown -R 1000:1000 /data'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    logger.warn(`Failed to fix auctioneer permissions: ${result.stderr}`);
  }
}

/**
 * Fund test accounts for timeboost testing
 * Based on test-node.bash lines 578-582
 */
async function fundTestAccounts(ctx: InitContext, biddingTokenAddress: string): Promise<void> {
  logger.step('Funding alice and bob test accounts for timeboost');

  // Fund alice with ETH
  const aliceEthResult = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '10', '--to', 'user_alice', '--wait'],
    { cwd: ctx.workDir },
  );

  if (aliceEthResult.code !== 0) {
    throw new Error(`Failed to fund alice with ETH: ${aliceEthResult.stderr}`);
  }

  // Fund bob with ETH
  const bobEthResult = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '10', '--to', 'user_bob', '--wait'],
    { cwd: ctx.workDir },
  );

  if (bobEthResult.code !== 0) {
    throw new Error(`Failed to fund bob with ETH: ${bobEthResult.stderr}`);
  }

  // Transfer bidding tokens to alice
  const aliceTokenResult = await composeRun(
    'scripts',
    [
      'transfer-erc20',
      '--token',
      biddingTokenAddress,
      '--amount',
      '10000',
      '--from',
      'auctioneer',
      '--to',
      'user_alice',
    ],
    { cwd: ctx.workDir },
  );

  if (aliceTokenResult.code !== 0) {
    throw new Error(`Failed to transfer tokens to alice: ${aliceTokenResult.stderr}`);
  }

  // Transfer bidding tokens to bob
  const bobTokenResult = await composeRun(
    'scripts',
    [
      'transfer-erc20',
      '--token',
      biddingTokenAddress,
      '--amount',
      '10000',
      '--from',
      'auctioneer',
      '--to',
      'user_bob',
    ],
    { cwd: ctx.workDir },
  );

  if (bobTokenResult.code !== 0) {
    throw new Error(`Failed to transfer tokens to bob: ${bobTokenResult.stderr}`);
  }
}

/**
 * Update sequencer config to enable timeboost
 * Based on test-node.bash line 584
 */
async function updateSequencerConfig(
  ctx: InitContext,
  auctionContractAddress: string,
  auctioneerAddress: string,
): Promise<void> {
  logger.step('Updating sequencer config for timeboost');

  // Use sed to update the sequencer config JSON
  const sedCommand = `sed -i 's/\\("execution":{"sequencer":{"enable":true,"dangerous":{"timeboost":{"enable":\\)false/\\1true,"auction-contract-address":"${auctionContractAddress}","auctioneer-address":"${auctioneerAddress}"/' /config/sequencer_config.json`;

  const result = await composeRun('scripts', ['sh', '-c', sedCommand], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to update sequencer config: ${result.stderr}`);
  }
}

/**
 * Restart sequencer nodes after config update
 */
async function restartSequencers(ctx: InitContext): Promise<void> {
  logger.step('Restarting sequencer nodes');

  const { calculateInitialSequencerNodes } = await import('../config/services.js');
  const initialNodes = calculateInitialSequencerNodes({
    redundantsequencers: ctx.flags.redundantsequencers,
  });

  const result = await runWithCode(`docker compose restart ${initialNodes.join(' ')}`, {
    cwd: ctx.workDir,
    timeout: 120000,
  });

  if (result.code !== 0) {
    logger.warn(`Failed to restart sequencers: ${result.stderr}`);
  }
}

/**
 * Setup Timeboost Express Lane Auction
 * Only runs when --l2-timeboost flag is set
 *
 * Based on test-node.bash lines 568-586:
 * - Fund auctioneer account
 * - Deploy bidding token
 * - Deploy auction contract
 * - Write timeboost configs
 * - Fund test accounts (alice, bob)
 * - Update sequencer config
 * - Restart sequencers
 */
export async function setupTimeboost(ctx: InitContext): Promise<TimeboostConfig | undefined> {
  if (!ctx.flags.l2Timeboost) {
    logger.debug('Skipping Timeboost setup (not enabled)');
    return undefined;
  }

  logger.step('Setting up Timeboost Express Lane Auction');

  // Fund auctioneer
  await fundAuctioneer(ctx);

  // Deploy bidding token
  const biddingTokenAddress = await deployBiddingToken(ctx);

  // Deploy auction contract
  const auctionContractAddress = await deployAuctionContract(ctx, biddingTokenAddress);

  // Get auctioneer address
  const auctioneerAddress = await getAuctioneerAddress(ctx);

  logger.info(`Bidding token: ${biddingTokenAddress}`);
  logger.info(`Auction contract: ${auctionContractAddress}`);

  // Write timeboost configs
  await writeTimeboostConfigs(ctx, auctionContractAddress);

  // Fix permissions
  await fixAuctioneerPermissions(ctx);

  // Fund test accounts
  await fundTestAccounts(ctx, biddingTokenAddress);

  // Update sequencer config
  await updateSequencerConfig(ctx, auctionContractAddress, auctioneerAddress);

  // Restart sequencers to apply config
  await restartSequencers(ctx);

  logger.success('Timeboost setup complete');

  return {
    biddingTokenAddress,
    auctionContractAddress,
    auctioneerAddress,
  };
}
