/**
 * Init command - initializes testnode with contract deployment
 */

import { type ValidationResult, validateFlags } from '../config/validation.js';
import { runInit } from '../orchestration/index.js';
import type { TestnodeFlags } from '../types/flags.js';
import { logger } from '../utils/logger.js';

/**
 * Flags for the init command parsed from CLI
 */
export interface InitCommandFlags {
  force: boolean;
  simple: boolean;
  l3node: boolean;
  l3FeeToken: boolean;
  l3FeeTokenDecimals: number;
  l3FeeTokenPricer: boolean;
  l3TokenBridge: boolean;
  tokenbridge: boolean;
  blockscout: boolean;
  l2Anytrust: boolean;
  l2Timeboost: boolean;
  pos: boolean;
  validate: boolean;
  batchposters: 0 | 1 | 2 | 3;
  redundantsequencers: 0 | 1 | 2 | 3;
  devNitro: boolean;
  devBlockscout: boolean;
  devContracts: boolean;
  build: boolean;
  buildDevNitro: boolean;
  buildDevBlockscout: boolean;
  buildUtils: boolean;
  forceBuildUtils: boolean;
  buildNodeImages: boolean;
  l1Traffic: boolean;
  l2Traffic: boolean;
  l3Traffic: boolean;
  ci: boolean;
  verbose: boolean;
}

export interface InitCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
}

/**
 * Convert CLI parsed flags to full TestnodeFlags
 * Applies flag side effects based on test-node.bash behavior
 */
function toTestnodeFlags(flags: InitCommandFlags): TestnodeFlags {
  // Determine if simple mode should be disabled based on other flags
  // Based on test-node.bash: --dev, --validate, --batchposters > 1, --redundantsequencers > 0
  // all require simple=false for proper operation
  let effectiveSimple = flags.simple;
  if (flags.devNitro || flags.devBlockscout) {
    effectiveSimple = false;
  }
  if (flags.validate) {
    effectiveSimple = false;
  }
  if (flags.batchposters > 1) {
    effectiveSimple = false;
  }
  if (flags.redundantsequencers > 0) {
    effectiveSimple = false;
  }

  return {
    init: true,
    force: flags.force,
    run: true,
    detach: false,
    nowait: false,
    simple: effectiveSimple,
    l3node: flags.l3node,
    l3FeeToken: flags.l3FeeToken,
    l3FeeTokenDecimals: flags.l3FeeTokenDecimals,
    l3FeeTokenPricer: flags.l3FeeTokenPricer,
    l3TokenBridge: flags.l3TokenBridge,
    tokenbridge: flags.tokenbridge,
    blockscout: flags.blockscout,
    l2Anytrust: flags.l2Anytrust,
    l2Timeboost: flags.l2Timeboost,
    pos: flags.pos,
    validate: flags.validate,
    batchposters: flags.batchposters,
    redundantsequencers: flags.redundantsequencers,
    devNitro: flags.devNitro,
    devBlockscout: flags.devBlockscout,
    devContracts: flags.devContracts,
    build: flags.build,
    buildDevNitro: flags.buildDevNitro,
    buildDevBlockscout: flags.buildDevBlockscout,
    buildUtils: flags.buildUtils,
    forceBuildUtils: flags.forceBuildUtils,
    buildNodeImages: flags.buildNodeImages,
    l1Traffic: flags.l1Traffic,
    l2Traffic: flags.l2Traffic,
    l3Traffic: flags.l3Traffic,
    ci: flags.ci,
    verbose: flags.verbose,
  };
}

/**
 * Display validation warnings to user
 */
function displayWarnings(result: ValidationResult): void {
  for (const warning of result.warnings) {
    logger.warn(warning.message);
  }
}

/**
 * Initialize testnode with contract deployment
 */
export async function initCommand(
  flags: InitCommandFlags,
  options: InitCommandOptions = {},
): Promise<void> {
  const testnodeFlags = toTestnodeFlags(flags);

  // Validate flags
  const validation = validateFlags(testnodeFlags);

  if (!validation.valid) {
    for (const error of validation.errors) {
      logger.error(error.message);
    }
    throw new Error('Invalid flag configuration');
  }

  // Display warnings
  if (validation.warnings.length > 0) {
    displayWarnings(validation);
  }

  // Run initialization
  const workDir = options.cwd ?? process.cwd();
  await runInit(testnodeFlags, workDir);
}
