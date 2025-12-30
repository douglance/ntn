# nitro-testnode-cli

TypeScript CLI for managing Arbitrum Nitro testnode environments. This tool provides a modern, type-safe interface for deploying and managing local Arbitrum development chains.

## Prerequisites

- **Node.js 20+** - Required for running the CLI
- **Docker** - For container orchestration
- **Docker Compose** - For multi-container management
- **Docker BuildKit** (optional) - Required for CI mode and faster builds

## Installation

### From Source

```bash
cd cli
npm install
```

### Development Usage

Run directly with tsx (no build required):

```bash
cd cli
npm run dev -- <command> [options]
```

### Production Build

```bash
cd cli
npm run build
./dist/bin/testnode.js <command> [options]
```

## Quick Start

### Basic L2 Testnode

Initialize and start a basic L2 testnode:

```bash
# Initialize (deploys contracts, configures services)
npm run dev -- init --force

# In a new terminal, check status
npm run dev -- status

# Stop when done
npm run dev -- stop
```

### Detached Mode

Run in the background:

```bash
npm run dev -- init --force
npm run dev -- start --detach
```

### Full Featured Setup

Initialize with L3, token bridges, and block explorer:

```bash
npm run dev -- init --force --l3node --tokenbridge --l3-token-bridge --blockscout
```

## Commands Reference

### init

Initialize testnode by deploying contracts and starting services.

```bash
testnode init [options]
```

This command performs a complete initialization:
1. Cleans up any existing containers and volumes
2. Builds Docker images (if needed)
3. Starts the L1 Ethereum node
4. Deploys L2 contracts and configures nodes
5. Optionally deploys L3 chain, token bridges, and additional services

### start

Start previously initialized testnode services.

```bash
testnode start [options]
```

Use this after running `init` to restart services without redeploying contracts.

### stop

Stop running testnode services.

```bash
testnode stop [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--clean` | `-c` | Remove volumes when stopping |

### status

Show currently running testnode containers.

```bash
testnode status
```

### clean

Remove all testnode data and volumes with confirmation.

```bash
testnode clean [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--force` | `-f` | Skip confirmation prompt |
| `--prune-images` | | Also prune unused Docker images |

### script

Run commands in the scripts container for testing operations.

```bash
testnode script <command..>
```

Examples:

```bash
# Send ETH on L2
testnode script send-l2 --to address_0x...

# Get help for available scripts
testnode script --help
```

## Configuration Options

### Global Options

Available for all commands:

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--verbose` | `-v` | boolean | false | Enable verbose output |
| `--help` | `-h` | | | Show help |
| `--version` | `-V` | | | Show version |

### Init Command Options

#### Basic Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--force` | `-f` | boolean | false | Skip confirmation prompt |
| `--simple` | | boolean | true | Simple mode (single node as sequencer/poster/staker) |
| `--ci` | | boolean | false | CI mode (optimized for automated environments) |

#### L2 Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--validate` | boolean | false | Enable WASM validation |
| `--blockscout` | boolean | false | Enable Blockscout block explorer |
| `--tokenbridge` | boolean | false | Deploy L1-L2 token bridge |
| `--l2-anytrust` | boolean | false | Run L2 as AnyTrust chain |
| `--l2-timeboost` | boolean | false | Enable Timeboost on L2 |
| `--pos` | boolean | false | Use Proof of Stake L1 (Prysm) |

#### L3 Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--l3node` | boolean | false | Deploy L3 chain on top of L2 |
| `--l3-token-bridge` | boolean | false | Deploy L2-L3 token bridge |
| `--l3-fee-token` | boolean | false | Use custom fee token for L3 |
| `--l3-fee-token-decimals` | number | 18 | Custom fee token decimals (0-36) |
| `--l3-fee-token-pricer` | boolean | false | Deploy fee token pricer for L3 |

#### Scaling Options

| Option | Type | Default | Choices | Description |
|--------|------|---------|---------|-------------|
| `--batchposters` | number | 1 | 0, 1, 2, 3 | Number of batch posters |
| `--redundantsequencers` | number | 0 | 0, 1, 2, 3 | Number of redundant sequencers |

#### Build Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--build` | boolean | false | Rebuild Docker images |
| `--no-build` | boolean | false | Don't rebuild Docker images |
| `--build-utils` | boolean | false | Build utility images |
| `--force-build-utils` | boolean | false | Force rebuild utility images |
| `--dev` | array | [] | Use dev builds (nitro, blockscout) |
| `--dev-contracts` | boolean | false | Use local development contracts |

#### Traffic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--no-l1-traffic` | boolean | false | Disable L1 traffic generation |
| `--no-l2-traffic` | boolean | false | Disable L2 traffic generation |
| `--no-l3-traffic` | boolean | false | Disable L3 traffic generation |

### Start Command Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--detach` | `-d` | boolean | false | Detach after starting |
| `--nowait` | | boolean | false | Don't wait for services (requires --detach) |
| `--simple` | | boolean | true | Simple mode (single node) |
| `--l3node` | | boolean | false | Include L3 node |
| `--blockscout` | | boolean | false | Include Blockscout |
| `--l2-anytrust` | | boolean | false | L2 is AnyTrust chain |
| `--l2-timeboost` | | boolean | false | L2 has Timeboost enabled |
| `--validate` | | boolean | false | Include validator |
| `--batchposters` | | number | 1 | Number of batch posters (0-3) |
| `--redundantsequencers` | | number | 0 | Number of redundant sequencers (0-3) |

## Examples

### Basic L2 Testnode

```bash
npm run dev -- init --force
```

### L2 with Validation

Enable WASM validation for testing dispute resolution:

```bash
npm run dev -- init --force --validate
```

### L2 with L3 Chain

Deploy a full L2 + L3 stack:

```bash
npm run dev -- init --force --l3node
```

### L2 with Token Bridges and L3

Deploy with complete token bridge infrastructure:

```bash
npm run dev -- init --force --l3node --tokenbridge --l3-token-bridge
```

### L2 with AnyTrust

Run L2 as an AnyTrust chain (data availability committee):

```bash
npm run dev -- init --force --l2-anytrust
```

### L2 with Timeboost

Enable Timeboost for transaction ordering auctions:

```bash
npm run dev -- init --force --l2-timeboost
```

### Full Featured Setup

Deploy everything for comprehensive testing:

```bash
npm run dev -- init --force \
  --l3node \
  --tokenbridge \
  --l3-token-bridge \
  --blockscout \
  --validate
```

### Custom L3 Fee Token

Deploy L3 with a custom ERC-20 fee token:

```bash
npm run dev -- init --force --l3node --l3-fee-token --l3-fee-token-decimals 6
```

### Scaled Deployment

Deploy with multiple batch posters and redundant sequencers:

```bash
npm run dev -- init --force --batchposters 2 --redundantsequencers 2
```

### CI Mode

Optimized initialization for automated testing:

```bash
npm run dev -- init --force --ci
```

## Default Versions

The CLI uses these default versions (configurable in `src/config/defaults.ts`):

| Component | Version |
|-----------|---------|
| Nitro Node | v3.6.7-a7c9f1e |
| Blockscout | v1.1.0-0e716c8 |
| Nitro Contracts | v3.1.0 |
| Token Bridge | v1.2.5 |

### Chain IDs

| Chain | ID |
|-------|-----|
| L1 | 1337 |
| L2 | 412346 |
| L3 | 333333 |

## Network Endpoints

After initialization, services are available at:

| Service | URL |
|---------|-----|
| L1 (geth) RPC | http://localhost:8545 |
| L2 Sequencer RPC | http://localhost:8547 |
| L2 Sequencer WebSocket | ws://localhost:8548 |
| L3 Node RPC | http://localhost:3347 (when enabled) |
| Blockscout | http://localhost:4000 (when enabled) |

## Development

### Running from Source

```bash
cd cli
npm install
npm run dev -- <command>
```

### Building

```bash
npm run build
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Migration from test-node.bash

The TypeScript CLI provides equivalent functionality to the original bash script with improved type safety and error handling.

### Flag Mapping

| test-node.bash | CLI | Notes |
|----------------|-----|-------|
| `--init` | `init` | Now a separate command |
| `--detach` | `start --detach` | Available on start command |
| `--no-run` | N/A | Use `init` without `start` |
| `--force` | `--force` | Same behavior |
| `--dev` | `--dev nitro` | Now takes component names |
| `--blockscout` | `--blockscout` | Same behavior |
| `--tokenbridge` | `--tokenbridge` | Same behavior |
| `--l3node` | `--l3node` | Same behavior |
| `--l3-fee-token` | `--l3-fee-token` | Same behavior |
| `--l3-token-bridge` | `--l3-token-bridge` | Same behavior |
| `--batchposters N` | `--batchposters N` | Same behavior |
| `--redundantsequencers N` | `--redundantsequencers N` | Same behavior |
| `--validate` | `--validate` | Same behavior |
| `--l2-anytrust` | `--l2-anytrust` | Same behavior |
| `--l2-timeboost` | `--l2-timeboost` | Same behavior |
| `--pos` | `--pos` | Same behavior |

### Key Differences

1. **Command Structure**: The CLI uses subcommands (`init`, `start`, `stop`) instead of flags to control behavior
2. **Dev Builds**: Use `--dev nitro` or `--dev blockscout` instead of `--dev` alone
3. **Traffic Control**: Uses negative flags (`--no-l1-traffic`) instead of positive flags
4. **Type Safety**: All flags are validated at parse time with clear error messages

## Troubleshooting

### Docker Permission Errors

Ensure your user has permissions to run Docker:

```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Port Conflicts

Check for services using required ports:

```bash
lsof -i :8545  # L1
lsof -i :8547  # L2
```

### Clean Restart

If experiencing issues, perform a clean restart:

```bash
npm run dev -- clean --force
npm run dev -- init --force
```

### View Logs

Check container logs for debugging:

```bash
docker compose logs sequencer
docker compose logs geth
```

## License

MIT
