/**
 * Service calculation for nitro-testnode
 * Based on test-node.bash node list calculation (lines 337-379)
 */

/**
 * Flags required for service calculation
 * This is a subset of TestnodeFlags used by calculateServices
 */
export interface ServiceCalculationFlags {
  simple: boolean;
  redundantsequencers: 0 | 1 | 2 | 3;
  batchposters: 0 | 1 | 2 | 3;
  validate: boolean;
  l3node: boolean;
  blockscout: boolean;
  l2Timeboost: boolean;
}

/**
 * Docker Compose service names used by nitro-testnode
 */
export type ServiceName =
  // Core L2 services
  | 'geth'
  | 'sequencer'
  | 'redis'
  | 'poster'
  | 'poster_b'
  | 'poster_c'
  | 'staker-unsafe'
  | 'validator'
  // Redundant sequencers
  | 'sequencer_b'
  | 'sequencer_c'
  | 'sequencer_d'
  // L3 services
  | 'l3node'
  // Block explorer
  | 'blockscout'
  // Timeboost services
  | 'timeboost-auctioneer'
  | 'timeboost-bid-validator'
  // Consensus client (PoS)
  | 'beacon-chain'
  | 'validator-client'
  | 'prysm';

/**
 * Calculates the list of docker-compose services to run based on flags
 * Ports the logic from test-node.bash lines 337-379
 */
export function calculateServices(flags: ServiceCalculationFlags): ServiceName[] {
  const services: ServiceName[] = [];

  // Base sequencer is always included (bash line 337)
  services.push('sequencer');

  // Redis is needed for non-simple mode (bash line 340-342)
  if (!flags.simple) {
    services.push('redis');
  }

  // Redundant sequencers (bash lines 343-352)
  if (flags.redundantsequencers > 0) {
    services.push('sequencer_b');
  }
  if (flags.redundantsequencers > 1) {
    services.push('sequencer_c');
  }
  if (flags.redundantsequencers > 2) {
    services.push('sequencer_d');
  }

  // Batch posters - first poster only in non-simple mode (bash lines 354-362)
  if (flags.batchposters > 0 && !flags.simple) {
    services.push('poster');
  }
  if (flags.batchposters > 1) {
    services.push('poster_b');
  }
  if (flags.batchposters > 2) {
    services.push('poster_c');
  }

  // Validator or staker (bash lines 365-369)
  if (flags.validate) {
    services.push('validator');
  } else if (!flags.simple) {
    services.push('staker-unsafe');
  }

  // L3 node (bash lines 370-372)
  if (flags.l3node) {
    services.push('l3node');
  }

  // Blockscout (bash lines 373-375)
  if (flags.blockscout) {
    services.push('blockscout');
  }

  // Timeboost services (bash lines 377-379)
  if (flags.l2Timeboost) {
    services.push('timeboost-auctioneer');
    services.push('timeboost-bid-validator');
  }

  return services;
}

/**
 * Returns the initial sequencer nodes that need to be started first
 * Based on INITIAL_SEQ_NODES variable in bash script (lines 338, 345)
 */
export function calculateInitialSequencerNodes(
  flags: Pick<ServiceCalculationFlags, 'redundantsequencers'>,
): ServiceName[] {
  const nodes: ServiceName[] = ['sequencer'];

  // sequencer_b is also an initial sequencer node when redundant sequencers > 0
  if (flags.redundantsequencers > 0) {
    nodes.push('sequencer_b');
  }

  return nodes;
}

/**
 * Returns services grouped by category for display purposes
 */
export function categorizeServices(services: ServiceName[]): {
  core: ServiceName[];
  sequencers: ServiceName[];
  posters: ServiceName[];
  validation: ServiceName[];
  l3: ServiceName[];
  explorer: ServiceName[];
  timeboost: ServiceName[];
} {
  return {
    core: services.filter((s) => s === 'redis'),
    sequencers: services.filter(
      (s) => s === 'sequencer' || s === 'sequencer_b' || s === 'sequencer_c' || s === 'sequencer_d',
    ),
    posters: services.filter((s) => s === 'poster' || s === 'poster_b' || s === 'poster_c'),
    validation: services.filter((s) => s === 'validator' || s === 'staker-unsafe'),
    l3: services.filter((s) => s === 'l3node'),
    explorer: services.filter((s) => s === 'blockscout'),
    timeboost: services.filter(
      (s) => s === 'timeboost-auctioneer' || s === 'timeboost-bid-validator',
    ),
  };
}

/**
 * Formats service list for docker-compose command
 */
export function formatServicesForCompose(services: ServiceName[]): string {
  return services.join(' ');
}
