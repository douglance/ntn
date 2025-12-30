/**
 * Docker image build orchestration
 * Based on test-node.bash lines 381-436
 */

import { BLOCKSCOUT_VERSION, NITRO_NODE_VERSION } from '../config/defaults.js';
import { calculateServices } from '../config/services.js';
import { composeBuild } from '../docker/compose.js';
import {
  buildImage,
  buildImageFromDirectory,
  imageExists,
  pullImage,
  tagImage,
} from '../docker/images.js';
import { logger } from '../utils/logger.js';
import { runStreaming } from '../utils/shell.js';
import type { InitContext } from './index.js';

/**
 * Build dev nitro image from source
 * Based on test-node.bash lines 381-392
 */
async function buildDevNitro(ctx: InitContext): Promise<void> {
  const nitroSrc = process.env.NITRO_SRC ?? `${ctx.workDir}/..`;

  logger.step('Building Nitro from source');
  logger.debug(`NITRO_SRC: ${nitroSrc}`);

  const exitCode = await buildImageFromDirectory(nitroSrc, 'nitro-node-dev', {
    target: 'nitro-node-dev',
    cwd: ctx.workDir,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to build dev nitro image');
  }
}

/**
 * Build dev blockscout image
 * Based on test-node.bash lines 393-398
 * Command: docker build blockscout -t blockscout -f blockscout/docker/Dockerfile
 */
async function buildDevBlockscout(ctx: InitContext): Promise<void> {
  logger.step('Building Blockscout');

  // Use the docker subdirectory Dockerfile with blockscout as the context
  const exitCode = await buildImage(
    `${ctx.workDir}/blockscout/docker/Dockerfile`,
    'blockscout',
    {},
    {
      context: `${ctx.workDir}/blockscout`,
      cwd: ctx.workDir,
    },
  );

  if (exitCode !== 0) {
    throw new Error('Failed to build dev blockscout image');
  }
}

/**
 * Build utility images (scripts, rollupcreator, tokenbridge)
 * Based on test-node.bash lines 400-416
 */
async function buildUtilityImages(ctx: InitContext): Promise<void> {
  const services = ['scripts', 'rollupcreator'];

  // Add tokenbridge if needed (bash lines 403-405)
  if (ctx.flags.tokenbridge || ctx.flags.l3TokenBridge || ctx.flags.ci) {
    services.push('tokenbridge');
  }

  logger.step(`Building utility images: ${services.join(', ')}`);

  // Use buildx bake in CI for better caching (bash lines 407-416)
  if (process.env.CI) {
    logger.debug('CI mode detected, using buildx bake for utility images');
    const exitCode = await runStreaming(
      'docker',
      [
        'buildx',
        'bake',
        '--allow=fs=/tmp',
        '--file',
        'docker-compose.yaml',
        '--file',
        'docker-compose-ci-cache.json',
        ...services,
      ],
      { cwd: ctx.workDir },
    );

    if (exitCode !== 0) {
      throw new Error('Failed to build utility images with buildx bake');
    }
  } else {
    const exitCode = await composeBuild(services, {
      cwd: ctx.workDir,
      noCache: ctx.flags.forceBuildUtils,
      noRm: true,
    });

    if (exitCode !== 0) {
      throw new Error('Failed to build utility images');
    }
  }
}

/**
 * Setup nitro node image (pull or tag dev)
 * Based on test-node.bash lines 418-423
 */
async function setupNitroNodeImage(ctx: InitContext): Promise<void> {
  if (ctx.flags.devNitro) {
    logger.step('Tagging dev nitro image');
    const tagged = await tagImage('nitro-node-dev:latest', 'nitro-node-dev-testnode');
    if (!tagged) {
      throw new Error('Failed to tag dev nitro image');
    }
  } else {
    logger.step(`Pulling nitro node image: ${NITRO_NODE_VERSION}`);

    // Check if image already exists
    const exists = await imageExists(NITRO_NODE_VERSION);
    if (!exists) {
      const exitCode = await pullImage(NITRO_NODE_VERSION);
      if (exitCode !== 0) {
        throw new Error(`Failed to pull nitro node image: ${NITRO_NODE_VERSION}`);
      }
    } else {
      logger.debug('Image already exists, skipping pull');
    }

    const tagged = await tagImage(NITRO_NODE_VERSION, 'nitro-node-dev-testnode');
    if (!tagged) {
      throw new Error('Failed to tag nitro node image');
    }
  }

  logger.success('Nitro node image ready');
}

/**
 * Setup blockscout image (pull or tag dev)
 * Based on test-node.bash lines 425-431
 */
async function setupBlockscoutImage(ctx: InitContext): Promise<void> {
  if (!ctx.flags.blockscout) {
    return;
  }

  if (ctx.flags.devBlockscout) {
    logger.step('Tagging dev blockscout image');
    const tagged = await tagImage('blockscout:latest', 'blockscout-testnode');
    if (!tagged) {
      throw new Error('Failed to tag dev blockscout image');
    }
  } else {
    logger.step(`Pulling blockscout image: ${BLOCKSCOUT_VERSION}`);

    // Check if image already exists
    const exists = await imageExists(BLOCKSCOUT_VERSION);
    if (!exists) {
      const exitCode = await pullImage(BLOCKSCOUT_VERSION);
      if (exitCode !== 0) {
        throw new Error(`Failed to pull blockscout image: ${BLOCKSCOUT_VERSION}`);
      }
    } else {
      logger.debug('Image already exists, skipping pull');
    }

    const tagged = await tagImage(BLOCKSCOUT_VERSION, 'blockscout-testnode');
    if (!tagged) {
      throw new Error('Failed to tag blockscout image');
    }
  }

  logger.success('Blockscout image ready');
}

/**
 * Build node images using docker compose build
 * Based on test-node.bash lines 434-436
 */
async function buildNodeImages(ctx: InitContext): Promise<void> {
  logger.step('Building node images');

  // Calculate services based on flags, matching bash's $NODES variable
  const services = calculateServices(ctx.flags);

  // Always use docker compose build for node images (bash line 435)
  const exitCode = await composeBuild(services, {
    cwd: ctx.workDir,
    noRm: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to build node images');
  }

  logger.success('Node images built');
}

/**
 * Build all required Docker images based on flags
 */
export async function buildDockerImages(ctx: InitContext): Promise<void> {
  // Build dev nitro if requested (bash lines 381-392)
  if (ctx.flags.devNitro && ctx.flags.buildDevNitro) {
    await buildDevNitro(ctx);
  }

  // Build dev blockscout if requested (bash lines 393-398)
  if (ctx.flags.devBlockscout && ctx.flags.buildDevBlockscout && ctx.flags.blockscout) {
    await buildDevBlockscout(ctx);
  }

  // Build utility images if requested (bash lines 400-416)
  if (ctx.flags.buildUtils) {
    await buildUtilityImages(ctx);
  }

  // Setup nitro node image (bash lines 418-423)
  await setupNitroNodeImage(ctx);

  // Setup blockscout image if enabled (bash lines 425-431)
  await setupBlockscoutImage(ctx);

  // Build node images if requested (bash lines 434-436)
  if (ctx.flags.buildNodeImages) {
    await buildNodeImages(ctx);
  }

  logger.success('Docker images ready');
}
