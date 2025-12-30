/**
 * Traffic generator setup orchestration
 * Based on test-node.bash lines 488-490 (L1), 607-611 (L2), 691-695 (L3)
 */

import { spawn } from 'node:child_process';
import { composeRun } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import type { InitContext } from './index.js';

/** Number of iterations for background traffic (matches bash script) */
const BACKGROUND_TRAFFIC_ITERATIONS = '1000000';

/**
 * Setup L1 traffic generator
 * Based on test-node.bash lines 488-490
 *
 * Funds the l1user account and prepares for traffic generation.
 * Note: The actual background traffic generation loop is not started here
 * as it runs continuously in the background.
 */
async function setupL1TrafficGenerator(ctx: InitContext): Promise<void> {
  logger.step('Setting up L1 traffic generator');

  // Fund user_l1user account
  const fundResult = await composeRun(
    'scripts',
    ['send-l1', '--ethamount', '1000', '--to', 'user_l1user', '--wait'],
    { cwd: ctx.workDir },
  );

  if (fundResult.code !== 0) {
    throw new Error(`Failed to fund L1 traffic generator: ${fundResult.stderr}`);
  }

  logger.debug('L1 traffic generator account funded');
  logger.info('L1 traffic generator ready (background process can be started separately)');
}

/**
 * Setup L2 traffic generator
 * Based on test-node.bash lines 607-611
 *
 * Funds the traffic_generator account and prepares for traffic generation.
 */
async function setupL2TrafficGenerator(ctx: InitContext): Promise<void> {
  logger.step('Setting up L2 traffic generator');

  // Fund user_traffic_generator account
  const fundResult = await composeRun(
    'scripts',
    ['send-l2', '--ethamount', '100', '--to', 'user_traffic_generator', '--wait'],
    { cwd: ctx.workDir },
  );

  if (fundResult.code !== 0) {
    throw new Error(`Failed to fund L2 traffic generator: ${fundResult.stderr}`);
  }

  logger.debug('L2 traffic generator account funded');
  logger.info('L2 traffic generator ready (background process can be started separately)');
}

/**
 * Setup L3 traffic generator
 * Based on test-node.bash lines 691-695
 *
 * Funds the traffic_generator account on L3 and prepares for traffic generation.
 */
async function setupL3TrafficGenerator(ctx: InitContext): Promise<void> {
  logger.step('Setting up L3 traffic generator');

  // Fund user_traffic_generator account on L3
  const fundResult = await composeRun(
    'scripts',
    ['send-l3', '--ethamount', '10', '--to', 'user_traffic_generator', '--wait'],
    { cwd: ctx.workDir },
  );

  if (fundResult.code !== 0) {
    throw new Error(`Failed to fund L3 traffic generator: ${fundResult.stderr}`);
  }

  logger.debug('L3 traffic generator account funded');
  logger.info('L3 traffic generator ready (background process can be started separately)');
}

/**
 * Spawn a background traffic generator process (non-blocking)
 * Based on test-node.bash pattern: ... > /dev/null &
 */
function spawnBackgroundTraffic(args: string[], workDir: string, logPrefix: string): void {
  logger.debug(`${logPrefix}: docker compose ${args.join(' ')}`);

  const child = spawn('docker', ['compose', 'run', '--rm', ...args], {
    cwd: workDir,
    detached: true,
    stdio: 'ignore',
  });

  // Unref so the parent process can exit without waiting for this
  child.unref();

  logger.debug(`${logPrefix}: started in background (pid: ${child.pid})`);
}

/**
 * Start L1 background traffic (optional)
 * Based on test-node.bash line 490
 *
 * This starts the continuous traffic generation in the background.
 * The bash script runs: send-l1 --ethamount 0.0001 --from user_l1user --to user_l1user --wait --delay 1000 --times 1000000 > /dev/null &
 */
export function startL1TrafficBackground(ctx: InitContext): void {
  logger.step('Starting L1 background traffic');

  spawnBackgroundTraffic(
    [
      'scripts',
      'send-l1',
      '--ethamount',
      '0.0001',
      '--from',
      'user_l1user',
      '--to',
      'user_l1user',
      '--wait',
      '--delay',
      '1000',
      '--times',
      BACKGROUND_TRAFFIC_ITERATIONS,
    ],
    ctx.workDir,
    'L1 traffic',
  );
}

/**
 * Start L2 background traffic (optional)
 * Based on test-node.bash line 610
 */
export function startL2TrafficBackground(ctx: InitContext): void {
  logger.step('Starting L2 background traffic');

  spawnBackgroundTraffic(
    [
      'scripts',
      'send-l2',
      '--ethamount',
      '0.0001',
      '--from',
      'user_traffic_generator',
      '--to',
      'user_traffic_generator',
      '--wait',
      '--delay',
      '500',
      '--times',
      BACKGROUND_TRAFFIC_ITERATIONS,
    ],
    ctx.workDir,
    'L2 traffic',
  );
}

/**
 * Start L3 background traffic (optional)
 * Based on test-node.bash line 694
 */
export function startL3TrafficBackground(ctx: InitContext): void {
  logger.step('Starting L3 background traffic');

  spawnBackgroundTraffic(
    [
      'scripts',
      'send-l3',
      '--ethamount',
      '0.0001',
      '--from',
      'user_traffic_generator',
      '--to',
      'user_traffic_generator',
      '--wait',
      '--delay',
      '5000',
      '--times',
      BACKGROUND_TRAFFIC_ITERATIONS,
    ],
    ctx.workDir,
    'L3 traffic',
  );
}

/**
 * Setup all traffic generators based on flags
 *
 * Sets up traffic generators for L1, L2, and L3 based on the corresponding flags.
 * Each traffic generator funds the appropriate account and then starts background traffic.
 * Based on test-node.bash behavior where traffic runs continuously in the background.
 */
export async function setupTrafficGenerators(ctx: InitContext): Promise<void> {
  const hasAnyTraffic = ctx.flags.l1Traffic || ctx.flags.l2Traffic || ctx.flags.l3Traffic;

  if (!hasAnyTraffic) {
    logger.debug('No traffic generators enabled');
    return;
  }

  logger.step('Setting up traffic generators');

  // Setup and start L1 traffic if enabled
  if (ctx.flags.l1Traffic) {
    await setupL1TrafficGenerator(ctx);
    startL1TrafficBackground(ctx);
  }

  // Setup and start L2 traffic if enabled
  if (ctx.flags.l2Traffic) {
    await setupL2TrafficGenerator(ctx);
    startL2TrafficBackground(ctx);
  }

  // Setup and start L3 traffic if enabled (only if L3 is deployed)
  if (ctx.flags.l3Traffic && ctx.flags.l3node) {
    await setupL3TrafficGenerator(ctx);
    startL3TrafficBackground(ctx);
  }

  logger.success('Traffic generators setup complete');
}
