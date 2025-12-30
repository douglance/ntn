import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  type InitCommandFlags,
  type StartCommandFlags,
  cleanCommand,
  initCommand,
  scriptCommand,
  startCommand,
  statusCommand,
  stopCommand,
} from './commands/index.js';
import { logger, setVerbose } from './utils/index.js';

/**
 * Main CLI entry point
 */
export async function cli(args: string[]): Promise<void> {
  await yargs(hideBin(process.argv).concat(args.length > 0 ? [] : args))
    .scriptName('testnode')
    .usage('$0 <command> [options]')

    // Global options
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Verbose output',
      default: false,
    })

    // Commands
    .command(
      'init',
      'Initialize testnode (deploy contracts, start services)',
      (yargs) =>
        yargs
          .option('force', {
            alias: 'f',
            type: 'boolean',
            description: 'Skip confirmation prompt',
            default: false,
          })
          .option('simple', {
            type: 'boolean',
            description: 'Simple mode (single node as sequencer/poster/staker)',
            default: true,
          })
          .option('l3node', {
            type: 'boolean',
            description: 'Deploy L3 chain on top of L2',
            default: false,
          })
          .option('l3-fee-token', {
            type: 'boolean',
            description: 'Use custom fee token for L3',
            default: false,
          })
          .option('l3-fee-token-decimals', {
            type: 'number',
            description: 'Custom fee token decimals',
            default: 18,
          })
          .option('l3-fee-token-pricer', {
            type: 'boolean',
            description: 'Deploy fee token pricer for L3',
            default: false,
          })
          .option('l3-token-bridge', {
            type: 'boolean',
            description: 'Deploy L2-L3 token bridge',
            default: false,
          })
          .option('tokenbridge', {
            type: 'boolean',
            description: 'Deploy L1-L2 token bridge',
            default: false,
          })
          .option('blockscout', {
            type: 'boolean',
            description: 'Enable Blockscout block explorer',
            default: false,
          })
          .option('l2-anytrust', {
            type: 'boolean',
            description: 'Run L2 as AnyTrust chain',
            default: false,
          })
          .option('l2-timeboost', {
            type: 'boolean',
            description: 'Enable Timeboost on L2',
            default: false,
          })
          .option('pos', {
            type: 'boolean',
            description: 'Use Proof of Stake L1 (prysm)',
            default: false,
          })
          .option('validate', {
            type: 'boolean',
            description: 'Enable WASM validation',
            default: false,
          })
          .option('batchposters', {
            type: 'number',
            description: 'Number of batch posters (0-3)',
            default: 1,
            choices: [0, 1, 2, 3],
          })
          .option('redundantsequencers', {
            type: 'number',
            description: 'Number of redundant sequencers (0-3)',
            default: 0,
            choices: [0, 1, 2, 3],
          })
          .option('dev', {
            type: 'array',
            description: 'Use dev builds (nitro, blockscout)',
            default: [],
          })
          .option('dev-contracts', {
            type: 'boolean',
            description: 'Use local development contracts',
            default: false,
          })
          .option('build', {
            type: 'boolean',
            description: 'Rebuild docker images',
            default: false,
          })
          .option('no-build', {
            type: 'boolean',
            description: "Don't rebuild docker images",
            default: false,
          })
          .option('build-utils', {
            type: 'boolean',
            description: 'Build utility images',
            default: false,
          })
          .option('force-build-utils', {
            type: 'boolean',
            description: 'Force rebuild utility images',
            default: false,
          })
          .option('no-l1-traffic', {
            type: 'boolean',
            description: 'Disable L1 traffic generation',
            default: false,
          })
          .option('no-l2-traffic', {
            type: 'boolean',
            description: 'Disable L2 traffic generation',
            default: false,
          })
          .option('no-l3-traffic', {
            type: 'boolean',
            description: 'Disable L3 traffic generation',
            default: false,
          })
          .option('ci', {
            type: 'boolean',
            description: 'CI mode',
            default: false,
          }),
      async (argv) => {
        setVerbose(argv.verbose);

        // Parse dev array into individual flags
        const devArray = (argv.dev ?? []) as string[];
        const devNitro = devArray.includes('nitro');
        const devBlockscout = devArray.includes('blockscout');

        const flags: InitCommandFlags = {
          force: argv.force,
          simple: argv.simple,
          l3node: argv.l3node,
          l3FeeToken: argv['l3-fee-token'],
          l3FeeTokenDecimals: argv['l3-fee-token-decimals'],
          l3FeeTokenPricer: argv['l3-fee-token-pricer'],
          l3TokenBridge: argv['l3-token-bridge'],
          tokenbridge: argv.tokenbridge,
          blockscout: argv.blockscout,
          l2Anytrust: argv['l2-anytrust'],
          l2Timeboost: argv['l2-timeboost'],
          pos: argv.pos,
          validate: argv.validate,
          batchposters: argv.batchposters as 0 | 1 | 2 | 3,
          redundantsequencers: argv.redundantsequencers as 0 | 1 | 2 | 3,
          devNitro,
          devBlockscout,
          devContracts: argv['dev-contracts'],
          build: argv.build && !argv['no-build'],
          buildDevNitro: devNitro,
          buildDevBlockscout: devBlockscout,
          buildUtils: argv['build-utils'] ?? false,
          forceBuildUtils: argv['force-build-utils'] ?? false,
          buildNodeImages: argv.build && !argv['no-build'],
          l1Traffic: !argv['no-l1-traffic'],
          l2Traffic: !argv['no-l2-traffic'],
          l3Traffic: !argv['no-l3-traffic'],
          ci: argv.ci,
          verbose: argv.verbose,
        };

        await initCommand(flags);
      },
    )

    .command(
      'start',
      'Start testnode services',
      (yargs) =>
        yargs
          .option('detach', {
            alias: 'd',
            type: 'boolean',
            description: 'Detach after starting',
            default: false,
          })
          .option('nowait', {
            type: 'boolean',
            description: "Don't wait for services (requires --detach)",
            default: false,
          })
          .option('simple', {
            type: 'boolean',
            description: 'Simple mode (single node)',
            default: true,
          })
          .option('l3node', {
            type: 'boolean',
            description: 'Include L3 node',
            default: false,
          })
          .option('blockscout', {
            type: 'boolean',
            description: 'Include Blockscout',
            default: false,
          })
          .option('l2-anytrust', {
            type: 'boolean',
            description: 'L2 is AnyTrust chain',
            default: false,
          })
          .option('l2-timeboost', {
            type: 'boolean',
            description: 'L2 has Timeboost enabled',
            default: false,
          })
          .option('validate', {
            type: 'boolean',
            description: 'Include validator',
            default: false,
          })
          .option('batchposters', {
            type: 'number',
            description: 'Number of batch posters (0-3)',
            default: 1,
            choices: [0, 1, 2, 3],
          })
          .option('redundantsequencers', {
            type: 'number',
            description: 'Number of redundant sequencers (0-3)',
            default: 0,
            choices: [0, 1, 2, 3],
          }),
      async (argv) => {
        setVerbose(argv.verbose);

        const flags: StartCommandFlags = {
          detach: argv.detach,
          nowait: argv.nowait,
          simple: argv.simple,
          l3node: argv.l3node,
          blockscout: argv.blockscout,
          l2Timeboost: argv['l2-timeboost'],
          validate: argv.validate,
          batchposters: argv.batchposters as 0 | 1 | 2 | 3,
          redundantsequencers: argv.redundantsequencers as 0 | 1 | 2 | 3,
        };

        await startCommand(flags);
      },
    )

    .command(
      'stop',
      'Stop testnode services',
      (yargs) =>
        yargs.option('clean', {
          alias: 'c',
          type: 'boolean',
          description: 'Remove volumes when stopping',
          default: false,
        }),
      async (argv) => {
        setVerbose(argv.verbose);
        await stopCommand({ removeVolumes: argv.clean });
      },
    )

    .command(
      'status',
      'Show running services',
      () => {},
      async (argv) => {
        setVerbose(argv.verbose);
        await statusCommand();
      },
    )

    .command(
      'clean',
      'Remove all data and volumes',
      (yargs) =>
        yargs
          .option('force', {
            alias: 'f',
            type: 'boolean',
            description: 'Skip confirmation prompt',
            default: false,
          })
          .option('prune-images', {
            type: 'boolean',
            description: 'Also prune unused docker images',
            default: false,
          }),
      async (argv) => {
        setVerbose(argv.verbose);
        await cleanCommand({
          force: argv.force,
          pruneImages: argv['prune-images'],
        });
      },
    )

    .command(
      'script <command..>',
      'Run command in scripts container',
      (yargs) =>
        yargs.positional('command', {
          type: 'string',
          description: 'Command to run',
          array: true,
        }),
      async (argv) => {
        setVerbose(argv.verbose);
        const command = (argv.command ?? []) as string[];
        await scriptCommand(command);
      },
    )

    .demandCommand(1, 'Please specify a command')
    .recommendCommands()
    .strict()
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .wrap(100)
    .parse();
}
