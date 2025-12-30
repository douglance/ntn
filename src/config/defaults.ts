/**
 * Default values and constants for nitro-testnode
 * Based on test-node.bash header (lines 5-75)
 */

// Docker image versions
export const NITRO_NODE_VERSION = 'offchainlabs/nitro-node:v3.6.7-a7c9f1e';
export const BLOCKSCOUT_VERSION = 'offchainlabs/blockscout:v1.1.0-0e716c8';

// Contract versions
export const DEFAULT_NITRO_CONTRACTS_VERSION = 'v3.1.0';
export const DEFAULT_TOKEN_BRIDGE_VERSION = 'v1.2.5';

// Chain IDs
export const DEFAULT_L1_CHAIN_ID = 1337;
export const DEFAULT_L2_CHAIN_ID = 412346;
export const DEFAULT_L3_CHAIN_ID = 333333;

// Development private key (for local testnode only)
export const DEV_PRIVATE_KEY = 'b6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659';

// Scaling limits
export const MAX_BATCH_POSTERS = 3;
export const MAX_REDUNDANT_SEQUENCERS = 3;

// Fee token configuration
export const MIN_FEE_TOKEN_DECIMALS = 0;
export const MAX_FEE_TOKEN_DECIMALS = 36;
export const DEFAULT_FEE_TOKEN_DECIMALS = 18;
