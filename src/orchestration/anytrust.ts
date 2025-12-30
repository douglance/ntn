/**
 * AnyTrust Data Availability Committee setup orchestration
 * Based on test-node.bash lines 520-544
 */

import { composeRun, composeUp } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import { cleanOutput } from '../utils/shell.js';
import type { InitContext } from './index.js';

/**
 * AnyTrust configuration state passed between setup phases
 */
export interface AnyTrustConfig {
  /** BLS public key for DAS committee A */
  dasBlsA: string;
  /** BLS public key for DAS committee B */
  dasBlsB: string;
}

/**
 * Create DAS committee directories with proper permissions
 * Based on test-node.bash lines 523-524
 */
async function createDasDirectories(ctx: InitContext): Promise<void> {
  logger.step('Creating DAS directories');

  // Create all required directories
  const mkdirResult = await composeRun(
    'datool',
    [
      'sh',
      '-c',
      'mkdir -p /das-committee-a/keys /das-committee-a/data /das-committee-a/metadata ' +
        '/das-committee-b/keys /das-committee-b/data /das-committee-b/metadata ' +
        '/das-mirror/data /das-mirror/metadata',
    ],
    { cwd: ctx.workDir },
  );

  if (mkdirResult.code !== 0) {
    throw new Error(`Failed to create DAS directories: ${mkdirResult.stderr}`);
  }

  // Fix ownership
  const chownResult = await composeRun('datool', ['sh', '-c', 'chown -R 1000:1000 /das*'], {
    cwd: ctx.workDir,
  });

  if (chownResult.code !== 0) {
    throw new Error(`Failed to fix DAS directory ownership: ${chownResult.stderr}`);
  }
}

/**
 * Generate DAS committee keys
 * Based on test-node.bash lines 525-526
 */
async function generateDasKeys(ctx: InitContext): Promise<void> {
  logger.step('Generating DAS committee keys');

  // Generate keys for committee A
  const keygenAResult = await composeRun('datool', ['keygen', '--dir', '/das-committee-a/keys'], {
    cwd: ctx.workDir,
  });

  if (keygenAResult.code !== 0) {
    throw new Error(`Failed to generate committee A keys: ${keygenAResult.stderr}`);
  }

  // Generate keys for committee B
  const keygenBResult = await composeRun('datool', ['keygen', '--dir', '/das-committee-b/keys'], {
    cwd: ctx.workDir,
  });

  if (keygenBResult.code !== 0) {
    throw new Error(`Failed to generate committee B keys: ${keygenBResult.stderr}`);
  }
}

/**
 * Write DAS configuration files
 * Based on test-node.bash lines 527-528
 */
async function writeDasConfigs(ctx: InitContext): Promise<void> {
  logger.step('Writing DAS configuration files');

  // Write committee config
  const committeeResult = await composeRun('scripts', ['write-l2-das-committee-config'], {
    cwd: ctx.workDir,
  });

  if (committeeResult.code !== 0) {
    throw new Error(`Failed to write DAS committee config: ${committeeResult.stderr}`);
  }

  // Write mirror config
  const mirrorResult = await composeRun('scripts', ['write-l2-das-mirror-config'], {
    cwd: ctx.workDir,
  });

  if (mirrorResult.code !== 0) {
    throw new Error(`Failed to write DAS mirror config: ${mirrorResult.stderr}`);
  }
}

/**
 * Read BLS public keys from DAS committees
 * Based on test-node.bash lines 530-531
 */
async function readBlsKeys(ctx: InitContext): Promise<{ dasBlsA: string; dasBlsB: string }> {
  logger.step('Reading DAS BLS public keys');

  // Read committee A BLS key
  const blsAResult = await composeRun(
    'datool',
    ['sh', '-c', 'cat /das-committee-a/keys/das_bls.pub'],
    { cwd: ctx.workDir },
  );

  if (blsAResult.code !== 0) {
    throw new Error(`Failed to read committee A BLS key: ${blsAResult.stderr}`);
  }

  // Read committee B BLS key
  const blsBResult = await composeRun(
    'datool',
    ['sh', '-c', 'cat /das-committee-b/keys/das_bls.pub'],
    { cwd: ctx.workDir },
  );

  if (blsBResult.code !== 0) {
    throw new Error(`Failed to read committee B BLS key: ${blsBResult.stderr}`);
  }

  const dasBlsA = cleanOutput(blsAResult.stdout);
  const dasBlsB = cleanOutput(blsBResult.stdout);

  logger.debug(`DAS BLS A: ${dasBlsA.substring(0, 20)}...`);
  logger.debug(`DAS BLS B: ${dasBlsB.substring(0, 20)}...`);

  return { dasBlsA, dasBlsB };
}

/**
 * Write keyset configuration and dump keyset
 * Based on test-node.bash lines 533-534
 */
async function writeKeysetConfig(
  ctx: InitContext,
  dasBlsA: string,
  dasBlsB: string,
): Promise<void> {
  logger.step('Writing DAS keyset configuration');

  // Write keyset config with BLS keys
  const keysetConfigResult = await composeRun(
    'scripts',
    ['write-l2-das-keyset-config', '--dasBlsA', dasBlsA, '--dasBlsB', dasBlsB],
    { cwd: ctx.workDir },
  );

  if (keysetConfigResult.code !== 0) {
    throw new Error(`Failed to write DAS keyset config: ${keysetConfigResult.stderr}`);
  }

  // Dump keyset to hex file
  const dumpKeysetResult = await composeRun(
    'datool',
    [
      'sh',
      '-c',
      "/usr/local/bin/datool dumpkeyset --conf.file /config/l2_das_keyset.json | grep 'Keyset: ' | awk '{ printf \"%s\", $2 }' > /config/l2_das_keyset.hex",
    ],
    { cwd: ctx.workDir },
  );

  if (dumpKeysetResult.code !== 0) {
    throw new Error(`Failed to dump keyset: ${dumpKeysetResult.stderr}`);
  }
}

/**
 * Set valid keyset on chain
 * Based on test-node.bash line 535
 */
async function setValidKeyset(ctx: InitContext): Promise<void> {
  logger.step('Setting valid keyset on chain');

  const result = await composeRun('scripts', ['set-valid-keyset'], {
    cwd: ctx.workDir,
    timeout: 120000, // 2 minute timeout
  });

  if (result.code !== 0) {
    throw new Error(`Failed to set valid keyset: ${result.stderr}`);
  }
}

/**
 * Start AnyTrust committee and mirror services
 * Based on test-node.bash lines 541-542
 */
async function startAnyTrustServices(ctx: InitContext): Promise<void> {
  logger.step('Starting AnyTrust committee and mirror');

  const exitCode = await composeUp(['das-committee-a', 'das-committee-b', 'das-mirror'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start AnyTrust services');
  }

  logger.success('AnyTrust services started');
}

/**
 * Setup AnyTrust Data Availability Committee
 * Only runs when --l2-anytrust flag is set
 *
 * Based on test-node.bash lines 520-544:
 * - Create DAS directories
 * - Generate DAS committee keys
 * - Write DAS configs
 * - Write keyset config
 * - Set valid keyset on chain
 * - Start committee and mirror services
 */
export async function setupAnyTrust(ctx: InitContext): Promise<AnyTrustConfig | undefined> {
  if (!ctx.flags.l2Anytrust) {
    logger.debug('Skipping AnyTrust setup (not enabled)');
    return undefined;
  }

  logger.step('Setting up AnyTrust Data Availability Committee');

  // Create directories with proper permissions
  await createDasDirectories(ctx);

  // Generate keys for both committees
  await generateDasKeys(ctx);

  // Write configuration files
  await writeDasConfigs(ctx);

  // Read BLS public keys
  const { dasBlsA, dasBlsB } = await readBlsKeys(ctx);

  // Write keyset config and dump to hex
  await writeKeysetConfig(ctx, dasBlsA, dasBlsB);

  // Set valid keyset on chain
  await setValidKeyset(ctx);

  // Start AnyTrust services if running
  if (ctx.flags.run !== false) {
    await startAnyTrustServices(ctx);
  }

  logger.success('AnyTrust setup complete');

  return { dasBlsA, dasBlsB };
}

/**
 * Build node config arguments for AnyTrust
 * Used when writing node configurations
 */
export function buildAnyTrustConfigArgs(config: AnyTrustConfig): string[] {
  return ['--anytrust', '--dasBlsA', config.dasBlsA, '--dasBlsB', config.dasBlsB];
}
