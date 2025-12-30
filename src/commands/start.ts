/**
 * Start command - starts testnode services
 */

import {
  type ServiceCalculationFlags,
  calculateServices,
  categorizeServices,
} from '../config/index.js';
import { composeUp } from '../docker/index.js';
import { logger } from '../utils/index.js';

/**
 * Flags for the start command
 */
export interface StartCommandFlags extends ServiceCalculationFlags {
  /** Detach after starting services */
  detach: boolean;
  /** Do not wait for services to be ready */
  nowait: boolean;
}

export interface StartCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
}

/**
 * Starts testnode services based on the provided flags
 *
 * Calculates which services to run based on flags (simple mode, L3, blockscout, etc.)
 * and starts them using docker compose up.
 */
export async function startCommand(
  flags: StartCommandFlags,
  options: StartCommandOptions = {},
): Promise<void> {
  const services = calculateServices(flags);
  const categories = categorizeServices(services);

  logger.info('Launching Testnode');
  logger.debug(`Services: ${services.join(', ')}`);

  if (categories.sequencers.length > 0) {
    logger.step(`Sequencers: ${categories.sequencers.join(', ')}`);
  }
  if (categories.posters.length > 0) {
    logger.step(`Batch Posters: ${categories.posters.join(', ')}`);
  }
  if (categories.validation.length > 0) {
    logger.step(`Validation: ${categories.validation.join(', ')}`);
  }
  if (categories.l3.length > 0) {
    logger.step(`L3: ${categories.l3.join(', ')}`);
  }
  if (categories.explorer.length > 0) {
    logger.step(`Block Explorer: ${categories.explorer.join(', ')}`);
  }
  if (categories.timeboost.length > 0) {
    logger.step(`Timeboost: ${categories.timeboost.join(', ')}`);
  }

  logger.info('If things go wrong - use --init to create a new chain');

  // Determine detach and wait modes based on test-node.bash lines 699-714:
  // - If detach + nowait: use -d (detach without waiting)
  // - If detach (without nowait): use -d --wait (detach, wait for healthy)
  // - If not detached: run in foreground (no -d flag)
  const shouldDetach = flags.detach;
  const shouldWait = flags.detach && !flags.nowait;

  const exitCode = await composeUp(services, {
    detach: shouldDetach,
    wait: shouldWait,
    cwd: options.cwd,
  });

  if (exitCode !== 0) {
    logger.error('Failed to start services');
    process.exit(exitCode);
  }

  if (flags.detach) {
    logger.success('Testnode services started');
  }
}
