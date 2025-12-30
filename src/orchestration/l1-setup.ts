/**
 * L1 chain setup orchestration
 * Based on test-node.bash lines 451-491
 */

import { composeRun, composeUp } from '../docker/compose.js';
import { logger } from '../utils/logger.js';
import { cleanOutput, getLastLine } from '../utils/shell.js';
import type { InitContext } from './index.js';
import { setupPrysm } from './prysm.js';

/**
 * Generate and setup L1 dev keys
 * Based on test-node.bash lines 451-455
 */
async function generateL1Keys(ctx: InitContext): Promise<void> {
  logger.step('Generating L1 keys');

  // Write accounts
  const writeAccountsResult = await composeRun('scripts', ['write-accounts'], { cwd: ctx.workDir });
  if (writeAccountsResult.code !== 0) {
    throw new Error(`Failed to write accounts: ${writeAccountsResult.stderr}`);
  }

  // Create passphrase file
  const passphraseResult = await composeRun(
    'geth',
    ['sh', '-c', 'echo passphrase > /datadir/passphrase'],
    { cwd: ctx.workDir },
  );
  if (passphraseResult.code !== 0) {
    throw new Error(`Failed to create passphrase: ${passphraseResult.stderr}`);
  }

  // Fix keystore ownership
  const keystoreResult = await composeRun('geth', ['sh', '-c', 'chown -R 1000:1000 /keystore'], {
    cwd: ctx.workDir,
  });
  if (keystoreResult.code !== 0) {
    throw new Error(`Failed to fix keystore ownership: ${keystoreResult.stderr}`);
  }

  // Fix config ownership
  const configResult = await composeRun('geth', ['sh', '-c', 'chown -R 1000:1000 /config'], {
    cwd: ctx.workDir,
  });
  if (configResult.code !== 0) {
    throw new Error(`Failed to fix config ownership: ${configResult.stderr}`);
  }

  logger.success('L1 keys generated');
}

/**
 * Write geth genesis configuration
 * Based on test-node.bash lines 457-458
 */
async function writeGethGenesis(ctx: InitContext): Promise<void> {
  logger.step('Writing geth genesis config');

  const result = await composeRun('scripts', ['write-geth-genesis-config'], { cwd: ctx.workDir });
  if (result.code !== 0) {
    throw new Error(`Failed to write geth genesis config: ${result.stderr}`);
  }
}

/**
 * Initialize geth with genesis configuration
 * Based on test-node.bash lines 468-469
 */
async function initializeGeth(ctx: InitContext): Promise<void> {
  logger.step('Initializing geth genesis configuration');

  const result = await composeRun(
    'geth',
    ['init', '--state.scheme', 'hash', '--datadir', '/datadir/', '/config/geth_genesis.json'],
    { cwd: ctx.workDir },
  );

  if (result.code !== 0) {
    throw new Error(`Failed to initialize geth: ${result.stderr}`);
  }
}

/**
 * Start geth and wait for sync
 * Based on test-node.bash lines 477-481
 */
async function startGeth(ctx: InitContext): Promise<void> {
  logger.step('Starting geth');

  const exitCode = await composeUp(['geth'], {
    cwd: ctx.workDir,
    detach: true,
  });

  if (exitCode !== 0) {
    throw new Error('Failed to start geth');
  }

  logger.step('Waiting for geth to sync');

  const syncResult = await composeRun('scripts', ['wait-for-sync', '--url', 'http://geth:8545'], {
    cwd: ctx.workDir,
    timeout: 120000, // 2 minute timeout for sync
  });

  if (syncResult.code !== 0) {
    throw new Error(`Geth sync failed: ${syncResult.stderr}`);
  }

  logger.success('Geth is ready');
}

/**
 * Fund validator, sequencer, and l2owner accounts
 * Based on test-node.bash lines 483-486
 */
async function fundAccounts(ctx: InitContext): Promise<void> {
  logger.step('Funding validator, sequencer and l2owner');

  const accounts = ['validator', 'sequencer', 'l2owner'];

  for (const account of accounts) {
    logger.debug(`Funding ${account}`);
    const result = await composeRun(
      'scripts',
      ['send-l1', '--ethamount', '1000', '--to', account, '--wait'],
      { cwd: ctx.workDir },
    );

    if (result.code !== 0) {
      throw new Error(`Failed to fund ${account}: ${result.stderr}`);
    }
  }

  logger.success('Accounts funded');
}

/**
 * Get L2 owner address for use in subsequent phases
 * Based on test-node.bash line 492
 */
async function getL2OwnerAddress(ctx: InitContext): Promise<string> {
  const result = await composeRun('scripts', ['print-address', '--account', 'l2owner'], {
    cwd: ctx.workDir,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to get l2owner address: ${result.stderr}`);
  }

  const address = cleanOutput(getLastLine(result.stdout));
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid l2owner address: ${address}`);
  }

  return address;
}

/**
 * Setup the L1 chain and fund accounts
 */
export async function setupL1(ctx: InitContext): Promise<void> {
  await generateL1Keys(ctx);
  await writeGethGenesis(ctx);
  await setupPrysm(ctx);
  await initializeGeth(ctx);
  await startGeth(ctx);
  await fundAccounts(ctx);
  // Note: L1 traffic setup is handled by traffic.ts based on --l1-traffic flag

  // Get l2owner address for use in L2 deploy phase
  ctx.l2OwnerAddress = await getL2OwnerAddress(ctx);
  logger.debug(`L2 owner address: ${ctx.l2OwnerAddress}`);

  logger.success('L1 setup complete');
}
