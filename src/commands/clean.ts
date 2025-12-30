/**
 * Clean command - removes all testnode data and volumes
 */

import {
  type VolumeInfo,
  composeDown,
  getVolumes,
  pruneImages,
  removeVolumes,
} from '../docker/index.js';
import { logger } from '../utils/index.js';

/** Volume prefix used by nitro-testnode docker compose */
const TESTNODE_VOLUME_PREFIX = 'nitro-testnode';

export interface CleanCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
  /** Skip confirmation prompt */
  force?: boolean;
  /** Also prune docker images */
  pruneImages?: boolean;
}

/**
 * Stops all running services
 */
async function stopServices(cwd?: string): Promise<void> {
  logger.step('Stopping services');
  const downResult = await composeDown({
    cwd,
    volumes: true,
    removeOrphans: true,
  });

  if (downResult.code !== 0) {
    logger.warn('Some services may not have stopped cleanly');
    logger.debug(`Error: ${downResult.stderr}`);
  }
}

/**
 * Removes testnode docker volumes
 */
async function cleanVolumes(volumes: VolumeInfo[], cwd?: string): Promise<void> {
  logger.step(`Removing ${volumes.length} volume(s)`);
  for (const volume of volumes) {
    logger.debug(`  - ${volume.name}`);
  }

  const volumeNames = volumes.map((v) => v.name);
  const result = await removeVolumes(volumeNames, { cwd, force: true });

  if (result.removed.length > 0) {
    logger.success(`Removed ${result.removed.length} volume(s)`);
  }

  if (result.failed.length > 0) {
    logger.warn(`Failed to remove ${result.failed.length} volume(s)`);
    for (const name of result.failed) {
      logger.debug(`  - ${name}`);
    }
  }
}

/**
 * Prunes unused docker images
 */
async function cleanImages(cwd?: string): Promise<void> {
  logger.step('Pruning unused images');
  const pruneResult = await pruneImages({ all: true, cwd });

  if (pruneResult.spaceClaimed !== '0B') {
    logger.success(`Reclaimed ${pruneResult.spaceClaimed} of disk space`);
  } else {
    logger.info('No unused images to prune');
  }
}

/**
 * Removes all testnode data including stopping services and removing volumes
 */
export async function cleanCommand(options: CleanCommandOptions = {}): Promise<void> {
  logger.info('Cleaning Testnode data');

  await stopServices(options.cwd);

  logger.step('Finding testnode volumes');
  const volumes = await getVolumes(TESTNODE_VOLUME_PREFIX, { cwd: options.cwd });

  if (volumes.length === 0) {
    logger.info('No testnode volumes found');
  } else {
    await cleanVolumes(volumes, options.cwd);
  }

  if (options.pruneImages) {
    await cleanImages(options.cwd);
  }

  logger.success('Testnode cleanup complete');
}
