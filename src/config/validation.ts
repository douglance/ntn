/**
 * Flag validation functions for nitro-testnode
 * Based on test-node.bash flag parsing (lines 77-335)
 */

import type { TestnodeFlags } from '../types/flags.js';
import {
  MAX_BATCH_POSTERS,
  MAX_FEE_TOKEN_DECIMALS,
  MAX_REDUNDANT_SEQUENCERS,
  MIN_FEE_TOKEN_DECIMALS,
} from './defaults.js';

/**
 * Result of flag validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error with code for programmatic handling
 */
export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  field?: keyof TestnodeFlags;
}

/**
 * Validation warning (non-fatal)
 */
export interface ValidationWarning {
  code: ValidationWarningCode;
  message: string;
  field?: keyof TestnodeFlags;
}

/**
 * Error codes for validation failures
 */
export type ValidationErrorCode =
  | 'NOWAIT_REQUIRES_DETACH'
  | 'L3_FEE_TOKEN_REQUIRES_L3NODE'
  | 'L3_FEE_TOKEN_PRICER_REQUIRES_FEE_TOKEN'
  | 'L3_FEE_TOKEN_DECIMALS_REQUIRES_FEE_TOKEN'
  | 'L3_FEE_TOKEN_DECIMALS_OUT_OF_RANGE'
  | 'L3_TOKEN_BRIDGE_REQUIRES_L3NODE'
  | 'BATCH_POSTERS_OUT_OF_RANGE'
  | 'REDUNDANT_SEQUENCERS_OUT_OF_RANGE';

/**
 * Warning codes for non-fatal validation issues
 */
export type ValidationWarningCode =
  | 'SIMPLE_MODE_IGNORES_BATCH_POSTERS'
  | 'SIMPLE_MODE_IGNORES_REDUNDANT_SEQUENCERS'
  | 'L3_TRAFFIC_WITHOUT_L3NODE';

/**
 * Validates runtime flag dependencies (bash line 198-201)
 */
function validateRuntimeDependencies(flags: TestnodeFlags): ValidationError[] {
  const errors: ValidationError[] = [];

  if (flags.nowait && !flags.detach) {
    errors.push({
      code: 'NOWAIT_REQUIRES_DETACH',
      message: '--nowait requires --detach to be provided',
      field: 'nowait',
    });
  }

  return errors;
}

/**
 * Validates L3-related flag dependencies (bash lines 225-257)
 */
function validateL3Dependencies(flags: TestnodeFlags): ValidationError[] {
  const errors: ValidationError[] = [];

  if (flags.l3FeeToken && !flags.l3node) {
    errors.push({
      code: 'L3_FEE_TOKEN_REQUIRES_L3NODE',
      message: '--l3-fee-token requires --l3node to be provided',
      field: 'l3FeeToken',
    });
  }

  if (flags.l3FeeTokenPricer && !flags.l3FeeToken) {
    errors.push({
      code: 'L3_FEE_TOKEN_PRICER_REQUIRES_FEE_TOKEN',
      message: '--l3-fee-token-pricer requires --l3-fee-token to be provided',
      field: 'l3FeeTokenPricer',
    });
  }

  if (flags.l3FeeTokenDecimals !== 18 && !flags.l3FeeToken) {
    errors.push({
      code: 'L3_FEE_TOKEN_DECIMALS_REQUIRES_FEE_TOKEN',
      message: '--l3-fee-token-decimals requires --l3-fee-token to be provided',
      field: 'l3FeeTokenDecimals',
    });
  }

  if (flags.l3TokenBridge && !flags.l3node) {
    errors.push({
      code: 'L3_TOKEN_BRIDGE_REQUIRES_L3NODE',
      message: '--l3-token-bridge requires --l3node to be provided',
      field: 'l3TokenBridge',
    });
  }

  return errors;
}

/**
 * Validates numeric range constraints (bash lines 208-211, 246-248, 272-275)
 */
function validateRangeConstraints(flags: TestnodeFlags): ValidationError[] {
  const errors: ValidationError[] = [];
  const decimalsOutOfRange =
    flags.l3FeeTokenDecimals < MIN_FEE_TOKEN_DECIMALS ||
    flags.l3FeeTokenDecimals > MAX_FEE_TOKEN_DECIMALS;

  if (decimalsOutOfRange) {
    errors.push({
      code: 'L3_FEE_TOKEN_DECIMALS_OUT_OF_RANGE',
      message: `l3-fee-token-decimals must be in range [${MIN_FEE_TOKEN_DECIMALS},${MAX_FEE_TOKEN_DECIMALS}], value: ${flags.l3FeeTokenDecimals}`,
      field: 'l3FeeTokenDecimals',
    });
  }

  if (flags.batchposters < 0 || flags.batchposters > MAX_BATCH_POSTERS) {
    errors.push({
      code: 'BATCH_POSTERS_OUT_OF_RANGE',
      message: `batchposters must be between 0 and ${MAX_BATCH_POSTERS}, value: ${flags.batchposters}`,
      field: 'batchposters',
    });
  }

  if (flags.redundantsequencers < 0 || flags.redundantsequencers > MAX_REDUNDANT_SEQUENCERS) {
    errors.push({
      code: 'REDUNDANT_SEQUENCERS_OUT_OF_RANGE',
      message: `redundantsequencers must be between 0 and ${MAX_REDUNDANT_SEQUENCERS}, value: ${flags.redundantsequencers}`,
      field: 'redundantsequencers',
    });
  }

  return errors;
}

/**
 * Generates warnings for suboptimal configurations
 */
function generateWarnings(flags: TestnodeFlags): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (flags.simple && flags.batchposters > 1) {
    warnings.push({
      code: 'SIMPLE_MODE_IGNORES_BATCH_POSTERS',
      message: 'Simple mode uses a single combined node; batchposters setting will be ignored',
      field: 'batchposters',
    });
  }

  if (flags.simple && flags.redundantsequencers > 0) {
    warnings.push({
      code: 'SIMPLE_MODE_IGNORES_REDUNDANT_SEQUENCERS',
      message: 'Simple mode uses a single sequencer; redundantsequencers setting will be ignored',
      field: 'redundantsequencers',
    });
  }

  if (flags.l3Traffic && !flags.l3node) {
    warnings.push({
      code: 'L3_TRAFFIC_WITHOUT_L3NODE',
      message: 'L3 traffic generation enabled but --l3node is not set',
      field: 'l3Traffic',
    });
  }

  return warnings;
}

/**
 * Validates flag combinations for compatibility
 * Returns errors for invalid combinations and warnings for suboptimal configurations
 */
export function validateFlags(flags: TestnodeFlags): ValidationResult {
  const errors: ValidationError[] = [
    ...validateRuntimeDependencies(flags),
    ...validateL3Dependencies(flags),
    ...validateRangeConstraints(flags),
  ];

  const warnings = generateWarnings(flags);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates flags and throws if invalid
 */
export function assertValidFlags(flags: TestnodeFlags): void {
  const result = validateFlags(flags);
  if (!result.valid) {
    const errorMessages = result.errors.map((e) => e.message).join('\n');
    throw new Error(`Invalid flag configuration:\n${errorMessages}`);
  }
}
