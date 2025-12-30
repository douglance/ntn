/**
 * Prysm PoS consensus setup orchestration
 * Based on test-node.bash lines 460-475
 */

import { composeRun, composeUp } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import type { InitContext } from './index.js';

/**
 * Write Prysm beacon chain configuration
 * Based on test-node.bash line 462
 */
async function writePrysmConfig(ctx: InitContext): Promise<void> {
  logger.step('Writing Prysm config');

  const result = await composeRun('scripts', ['write-prysm-config'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to write Prysm config: ${result.stderr}`);
  }
}

/**
 * Create beacon chain genesis state
 * Based on test-node.bash line 465
 */
async function createBeaconChainGenesis(ctx: InitContext): Promise<void> {
  logger.step('Creating Prysm genesis');

  const result = await composeRun('create_beacon_chain_genesis', [], {
    cwd: ctx.workDir,
    timeout: 120000, // 2 minute timeout
  });

  if (result.code !== 0) {
    throw new Error(`Failed to create beacon chain genesis: ${result.stderr}`);
  }
}

/**
 * Start Prysm beacon chain service
 * Based on test-node.bash line 473
 */
async function startBeaconChain(ctx: InitContext): Promise<void> {
  logger.step('Starting Prysm beacon chain');

  const exitCode = await composeUp(['prysm_beacon_chain'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start Prysm beacon chain');
  }
}

/**
 * Start Prysm validator service
 * Based on test-node.bash line 474
 */
async function startValidator(ctx: InitContext): Promise<void> {
  logger.step('Starting Prysm validator');

  const exitCode = await composeUp(['prysm_validator'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start Prysm validator');
  }
}

/**
 * Setup Prysm for PoS consensus
 * Only runs when --pos flag is set
 *
 * Based on test-node.bash lines 460-475:
 * - Write prysm config
 * - Create beacon chain genesis
 * - Start beacon chain
 * - Start validator
 */
export async function setupPrysm(ctx: InitContext): Promise<void> {
  if (!ctx.flags.pos) {
    logger.debug('Skipping Prysm setup (PoS not enabled)');
    return;
  }

  logger.step('Setting up Prysm PoS consensus');

  // Write prysm configuration
  await writePrysmConfig(ctx);

  // Create beacon chain genesis
  await createBeaconChainGenesis(ctx);

  // Start beacon chain and validator
  await startBeaconChain(ctx);
  await startValidator(ctx);

  logger.success('Prysm PoS setup complete');
}
