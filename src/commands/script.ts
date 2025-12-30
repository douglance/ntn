/**
 * Script command - runs commands in the scripts container
 */

import { composeRun } from '../docker/index.js';
import { logger } from '../utils/index.js';

export interface ScriptCommandOptions {
  /** Working directory for docker compose */
  cwd?: string;
}

/**
 * Runs a command in the scripts container using docker compose run
 *
 * This proxies commands to the testnode scripts container which has
 * access to deployment scripts, fund transfers, and other utilities.
 */
export async function scriptCommand(
  command: string[],
  options: ScriptCommandOptions = {},
): Promise<void> {
  if (command.length === 0) {
    logger.error('No command specified');
    process.exit(1);
  }

  const scriptName = command[0];
  logger.debug(`Running script: ${command.join(' ')}`);

  const result = await composeRun('scripts', command, {
    cwd: options.cwd,
  });

  // Output the script results
  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }

  if (result.code !== 0) {
    logger.error(`Script '${scriptName}' failed with exit code ${result.code}`);
    process.exit(result.code);
  }
}
