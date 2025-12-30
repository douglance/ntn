/**
 * Main orchestration module for nitro-testnode init workflow
 * Based on test-node.bash lines 438-560
 */

import { calculateServices } from '../config/services.js';
import { composeDown, composeUp } from '../docker/compose.js';
import type { TestnodeFlags } from '../types/flags.js';
import { logger } from '../utils/logger.js';
import { runWithCode } from '../utils/shell.js';
import type { AnyTrustConfig } from './anytrust.js';
import { buildDockerImages } from './docker-builds.js';
import { setupL1 } from './l1-setup.js';
import { configureL2Nodes } from './l2-config.js';
import { deployL2 } from './l2-deploy.js';
import { setupTrafficGenerators } from './traffic.js';

/** Volume prefix used by nitro-testnode docker compose */
const TESTNODE_VOLUME_PREFIX = 'nitro-testnode';

/**
 * Context passed between init phases containing state and configuration
 */
export interface InitContext {
  /** Parsed CLI flags */
  flags: TestnodeFlags;
  /** Working directory for docker compose operations */
  workDir: string;
  /** L2 owner address (populated during L1 setup) */
  l2OwnerAddress?: string;
  /** L2 owner private key (populated during L1 setup) */
  l2OwnerKey?: string;
  /** Sequencer address (populated during L2 deploy) */
  sequencerAddress?: string;
  /** WASM module root (populated during L2 deploy) */
  wasmRoot?: string;
  /** L1 chain ID */
  l1ChainId: number;
  /** AnyTrust configuration (populated during L2 deploy if enabled) */
  anyTrustConfig?: AnyTrustConfig;
}

/**
 * Init phase definition
 */
export interface InitPhase {
  /** Human-readable phase name */
  name: string;
  /** Execute the phase */
  run: (ctx: InitContext) => Promise<void>;
  /** Optional skip condition */
  skip?: (ctx: InitContext) => boolean;
}

/**
 * Cleanup existing containers and volumes
 * Based on test-node.bash lines 438-449
 */
async function cleanupExisting(ctx: InitContext): Promise<void> {
  logger.step('Removing old data');

  // docker compose down
  const downResult = await composeDown({ cwd: ctx.workDir });
  if (downResult.code !== 0) {
    logger.debug(`Compose down warning: ${downResult.stderr}`);
  }

  // Remove leftover containers
  const containersResult = await runWithCode(
    'docker container ls -a --filter label=com.docker.compose.project=nitro-testnode -q',
    { cwd: ctx.workDir },
  );

  if (containersResult.code === 0 && containersResult.stdout.trim()) {
    const containerIds = containersResult.stdout.trim().split('\n').filter(Boolean);
    if (containerIds.length > 0) {
      logger.debug(`Removing ${containerIds.length} leftover container(s)`);
      await runWithCode(`docker rm ${containerIds.join(' ')}`, { cwd: ctx.workDir });
    }
  }

  // Prune volumes with project label
  await runWithCode(
    `docker volume prune -f --filter label=com.docker.compose.project=${TESTNODE_VOLUME_PREFIX}`,
    { cwd: ctx.workDir },
  );

  // Remove leftover volumes
  const volumesResult = await runWithCode(
    `docker volume ls --filter label=com.docker.compose.project=${TESTNODE_VOLUME_PREFIX} -q`,
    { cwd: ctx.workDir },
  );

  if (volumesResult.code === 0 && volumesResult.stdout.trim()) {
    const volumeNames = volumesResult.stdout.trim().split('\n').filter(Boolean);
    if (volumeNames.length > 0) {
      logger.debug(`Removing ${volumeNames.length} leftover volume(s)`);
      await runWithCode(`docker volume rm ${volumeNames.join(' ')}`, { cwd: ctx.workDir });
    }
  }

  logger.success('Cleanup complete');
}

/**
 * Define all init phases in order
 */
function createInitPhases(): InitPhase[] {
  return [
    {
      name: 'Cleanup existing data',
      run: cleanupExisting,
    },
    {
      name: 'Build docker images',
      run: async (ctx) => {
        await buildDockerImages(ctx);
      },
    },
    {
      name: 'Setup L1 chain',
      run: async (ctx) => {
        await setupL1(ctx);
      },
    },
    {
      name: 'Deploy L2 chain',
      run: async (ctx) => {
        // deployL2 returns AnyTrust config if enabled
        ctx.anyTrustConfig = await deployL2(ctx);
      },
    },
    {
      name: 'Configure L2 nodes',
      run: async (ctx) => {
        await configureL2Nodes(ctx, ctx.anyTrustConfig);
      },
    },
    {
      name: 'Setup traffic generators',
      run: async (ctx) => {
        await setupTrafficGenerators(ctx);
      },
      skip: (ctx) => !ctx.flags.l1Traffic && !ctx.flags.l2Traffic && !ctx.flags.l3Traffic,
    },
    {
      name: 'Launch services',
      run: async (ctx) => {
        const services = calculateServices(ctx.flags);
        logger.step(`Starting services: ${services.join(', ')}`);

        // Use --wait if not nowait, otherwise just detach
        // Based on test-node.bash lines 699-714
        const useWait = !ctx.flags.nowait;

        const exitCode = await composeUp(services, {
          detach: true,
          wait: useWait,
          cwd: ctx.workDir,
        });

        if (exitCode !== 0) {
          throw new Error('Failed to launch services');
        }

        logger.success('Services launched');
      },
    },
  ];
}

/**
 * Run the complete init workflow
 */
export async function runInit(flags: TestnodeFlags, workDir: string): Promise<void> {
  logger.info('Initializing Nitro Testnode');

  const ctx: InitContext = {
    flags,
    workDir,
    l1ChainId: 1337,
  };

  const phases = createInitPhases();

  for (const phase of phases) {
    if (phase.skip?.(ctx)) {
      logger.debug(`Skipping phase: ${phase.name}`);
      continue;
    }

    logger.info(phase.name);

    try {
      await phase.run(ctx);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Phase "${phase.name}" failed: ${errorMessage}`);
      throw error;
    }
  }

  logger.success('Testnode initialization complete');
}

export { buildDockerImages } from './docker-builds.js';
export { setupL1 } from './l1-setup.js';
export { deployL2 } from './l2-deploy.js';
export { configureL2Nodes } from './l2-config.js';
export { setupPrysm } from './prysm.js';
export { setupAnyTrust, type AnyTrustConfig } from './anytrust.js';
export { setupTimeboost, type TimeboostConfig } from './timeboost.js';
export { deployL3 } from './l3-deploy.js';
export { setupTrafficGenerators } from './traffic.js';
