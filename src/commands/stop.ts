/**
 * Stop command - stops testnode services
 */

import { composeDown } from '../docker/index.js';
import { logger } from '../utils/index.js';

export interface StopCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
  /** Remove volumes when stopping */
  removeVolumes?: boolean;
}

/**
 * Stops all testnode services using docker compose down
 */
export async function stopCommand(options: StopCommandOptions = {}): Promise<void> {
  logger.info('Stopping Testnode services');

  const result = await composeDown({
    cwd: options.cwd,
    volumes: options.removeVolumes,
    removeOrphans: true,
  });

  if (result.code !== 0) {
    logger.error('Failed to stop services');
    if (result.stderr) {
      logger.debug(`Error: ${result.stderr}`);
    }
    process.exit(result.code);
  }

  logger.success('Testnode services stopped');
}
