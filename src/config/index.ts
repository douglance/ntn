/**
 * Config module exports
 */

// Default values and constants
export {
  NITRO_NODE_VERSION,
  BLOCKSCOUT_VERSION,
  DEFAULT_NITRO_CONTRACTS_VERSION,
  DEFAULT_TOKEN_BRIDGE_VERSION,
  DEFAULT_L1_CHAIN_ID,
  DEFAULT_L2_CHAIN_ID,
  DEFAULT_L3_CHAIN_ID,
  DEV_PRIVATE_KEY,
  MAX_BATCH_POSTERS,
  MAX_REDUNDANT_SEQUENCERS,
  MIN_FEE_TOKEN_DECIMALS,
  MAX_FEE_TOKEN_DECIMALS,
  DEFAULT_FEE_TOKEN_DECIMALS,
} from './defaults.js';

// Validation functions and types
export {
  validateFlags,
  assertValidFlags,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationErrorCode,
  type ValidationWarningCode,
} from './validation.js';

// Service calculation functions and types
export {
  calculateServices,
  calculateInitialSequencerNodes,
  categorizeServices,
  formatServicesForCompose,
  type ServiceCalculationFlags,
  type ServiceName,
} from './services.js';
