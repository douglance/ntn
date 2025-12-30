/**
 * All CLI flags for nitro-testnode
 * Based on test-node.bash flag parsing (lines 77-335)
 */
export interface TestnodeFlags {
  // === Initialization ===
  /** Initialize testnode (remove data, rebuild, deploy) */
  init: boolean;
  /** Force init without confirmation prompt */
  force: boolean;

  // === Dev Mode ===
  /** Use dev builds of nitro */
  devNitro: boolean;
  /** Use dev builds of blockscout */
  devBlockscout: boolean;
  /** Use local development version of contracts */
  devContracts: boolean;

  // === Build Control ===
  /** Rebuild docker images */
  build: boolean;
  /** Build dev nitro image */
  buildDevNitro: boolean;
  /** Build dev blockscout image */
  buildDevBlockscout: boolean;
  /** Build utils (scripts, rollupcreator, tokenbridge) */
  buildUtils: boolean;
  /** Force rebuild utils */
  forceBuildUtils: boolean;
  /** Build node images */
  buildNodeImages: boolean;

  // === Features ===
  /** Enable WASM validation of all blocks */
  validate: boolean;
  /** Enable blockscout block explorer */
  blockscout: boolean;
  /** Deploy L1-L2 token bridge */
  tokenbridge: boolean;
  /** Deploy L3 chain on top of L2 */
  l3node: boolean;
  /** Use custom fee token for L3 */
  l3FeeToken: boolean;
  /** Deploy fee token pricer */
  l3FeeTokenPricer: boolean;
  /** Custom fee token decimals */
  l3FeeTokenDecimals: number;
  /** Deploy L2-L3 token bridge */
  l3TokenBridge: boolean;
  /** Run L2 as AnyTrust chain */
  l2Anytrust: boolean;
  /** Enable Timeboost on L2 */
  l2Timeboost: boolean;

  // === Scaling ===
  /** Number of batch posters (0-3) */
  batchposters: 0 | 1 | 2 | 3;
  /** Number of redundant sequencers (0-3) */
  redundantsequencers: 0 | 1 | 2 | 3;

  // === Consensus ===
  /** Use Proof of Stake L1 (prysm) */
  pos: boolean;

  // === Runtime ===
  /** Run services after init */
  run: boolean;
  /** Detach after starting services */
  detach: boolean;
  /** Don't wait for services to be ready */
  nowait: boolean;
  /** Simple mode (single sequencer/poster/staker node) */
  simple: boolean;

  // === Traffic ===
  /** Generate L1 traffic */
  l1Traffic: boolean;
  /** Generate L2 traffic */
  l2Traffic: boolean;
  /** Generate L3 traffic */
  l3Traffic: boolean;

  // === CI ===
  /** CI mode */
  ci: boolean;

  // === Global ===
  /** Verbose output */
  verbose: boolean;
}

/**
 * Default flag values matching test-node.bash defaults
 */
export const defaultFlags: TestnodeFlags = {
  // Initialization
  init: false,
  force: false,

  // Dev Mode
  devNitro: false,
  devBlockscout: false,
  devContracts: false,

  // Build Control
  build: false,
  buildDevNitro: false,
  buildDevBlockscout: false,
  buildUtils: false,
  forceBuildUtils: false,
  buildNodeImages: false,

  // Features
  validate: false,
  blockscout: false,
  tokenbridge: false,
  l3node: false,
  l3FeeToken: false,
  l3FeeTokenPricer: false,
  l3FeeTokenDecimals: 18,
  l3TokenBridge: false,
  l2Anytrust: false,
  l2Timeboost: false,

  // Scaling
  batchposters: 1,
  redundantsequencers: 0,

  // Consensus
  pos: false,

  // Runtime
  run: true,
  detach: false,
  nowait: false,
  simple: true,

  // Traffic
  l1Traffic: true,
  l2Traffic: true,
  l3Traffic: true,

  // CI
  ci: false,

  // Global
  verbose: false,
};

/**
 * Flags specific to the init command
 */
export type InitFlags = Pick<
  TestnodeFlags,
  | 'force'
  | 'devNitro'
  | 'devBlockscout'
  | 'devContracts'
  | 'build'
  | 'buildDevNitro'
  | 'buildDevBlockscout'
  | 'buildUtils'
  | 'forceBuildUtils'
  | 'validate'
  | 'blockscout'
  | 'tokenbridge'
  | 'l3node'
  | 'l3FeeToken'
  | 'l3FeeTokenPricer'
  | 'l3FeeTokenDecimals'
  | 'l3TokenBridge'
  | 'l2Anytrust'
  | 'l2Timeboost'
  | 'batchposters'
  | 'redundantsequencers'
  | 'pos'
  | 'simple'
  | 'l1Traffic'
  | 'l2Traffic'
  | 'l3Traffic'
  | 'ci'
  | 'verbose'
>;

/**
 * Flags specific to the start command
 */
export type StartFlags = Pick<
  TestnodeFlags,
  | 'detach'
  | 'nowait'
  | 'simple'
  | 'l3node'
  | 'blockscout'
  | 'l2Anytrust'
  | 'l2Timeboost'
  | 'batchposters'
  | 'redundantsequencers'
  | 'validate'
  | 'l2Traffic'
  | 'l3Traffic'
  | 'verbose'
>;
