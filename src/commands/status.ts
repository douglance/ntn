/**
 * Status command - shows running testnode services
 */

import { composePs } from '../docker/index.js';
import { logger } from '../utils/index.js';

export interface StatusCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
}

/**
 * Displays the status of running testnode services
 */
export async function statusCommand(options: StatusCommandOptions = {}): Promise<void> {
  logger.info('Testnode Service Status');

  const output = await composePs([], { cwd: options.cwd });

  if (!output.trim()) {
    logger.warn('No services are currently running');
    return;
  }

  // Output the docker compose ps table directly
  console.log();
  console.log(output);
}
