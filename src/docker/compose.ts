import { type ExecOptions, run, runStreaming, runWithCode } from '../utils/shell.js';

export interface ComposeOptions extends ExecOptions {
  /** Path to docker-compose.yaml file */
  composeFile?: string;
  /** Project name for docker-compose */
  projectName?: string;
  /** Detached mode for up command */
  detach?: boolean;
  /** Wait for services to be healthy when detaching */
  wait?: boolean;
  /** Remove orphan containers */
  removeOrphans?: boolean;
  /** Skip image building */
  noBuild?: boolean;
  /** Force recreate containers */
  forceRecreate?: boolean;
  /** Remove volumes when running down */
  volumes?: boolean;
  /** Skip cache when building */
  noCache?: boolean;
  /** Do not remove intermediate containers */
  noRm?: boolean;
}

interface ComposeBaseArgs {
  composeFile?: string;
  projectName?: string;
}

function buildBaseArgs(options: ComposeBaseArgs): string[] {
  const args: string[] = [];
  if (options.composeFile) {
    args.push('-f', options.composeFile);
  }
  if (options.projectName) {
    args.push('-p', options.projectName);
  }
  return args;
}

/**
 * Run a command in a service container using docker compose run
 */
export async function composeRun(
  service: string,
  command: string[],
  options: ComposeOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const baseArgs = buildBaseArgs(options);
  const cmd = ['docker', 'compose', ...baseArgs, 'run', '--rm', service, ...command].join(' ');

  return runWithCode(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });
}

/**
 * Start services using docker compose up
 * Uses streaming for real-time output during long-running startup
 */
export async function composeUp(
  services: string[] = [],
  options: ComposeOptions = {},
): Promise<number> {
  const baseArgs = buildBaseArgs(options);
  const upArgs: string[] = [];

  if (options.detach) {
    upArgs.push('-d');
  }
  if (options.wait) {
    upArgs.push('--wait');
  }
  if (options.removeOrphans) {
    upArgs.push('--remove-orphans');
  }
  if (options.noBuild) {
    upArgs.push('--no-build');
  }
  if (options.forceRecreate) {
    upArgs.push('--force-recreate');
  }

  const args = ['compose', ...baseArgs, 'up', ...upArgs, ...services];

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * Stop and remove containers using docker compose down
 */
export async function composeDown(
  options: ComposeOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const baseArgs = buildBaseArgs(options);
  const downArgs: string[] = [];

  if (options.volumes) {
    downArgs.push('-v');
  }
  if (options.removeOrphans) {
    downArgs.push('--remove-orphans');
  }

  const cmd = ['docker', 'compose', ...baseArgs, 'down', ...downArgs].join(' ');

  return runWithCode(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });
}

/**
 * Build service images using docker compose build
 * Uses streaming for real-time build output
 */
export async function composeBuild(
  services: string[] = [],
  options: ComposeOptions = {},
): Promise<number> {
  const baseArgs = buildBaseArgs(options);
  const buildArgs: string[] = [];

  if (options.noCache) {
    buildArgs.push('--no-cache');
  }
  if (options.noRm) {
    buildArgs.push('--no-rm');
  }

  const args = ['compose', ...baseArgs, 'build', ...buildArgs, ...services];

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * Get the status of running services
 */
export async function composePs(
  services: string[] = [],
  options: ComposeOptions = {},
): Promise<string> {
  const baseArgs = buildBaseArgs(options);
  const cmd = ['docker', 'compose', ...baseArgs, 'ps', ...services].join(' ');

  const result = await run(cmd, {
    cwd: options.cwd,
    env: options.env,
  });

  return result.stdout;
}

/**
 * View logs for services
 */
export async function composeLogs(
  services: string[] = [],
  options: ComposeOptions & { follow?: boolean; tail?: number } = {},
): Promise<number> {
  const baseArgs = buildBaseArgs(options);
  const logArgs: string[] = [];

  if (options.follow) {
    logArgs.push('-f');
  }
  if (options.tail !== undefined) {
    logArgs.push('--tail', String(options.tail));
  }

  const args = ['compose', ...baseArgs, 'logs', ...logArgs, ...services];

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * Execute a command in a running container
 */
export async function composeExec(
  service: string,
  command: string[],
  options: ComposeOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const baseArgs = buildBaseArgs(options);
  const cmd = ['docker', 'compose', ...baseArgs, 'exec', '-T', service, ...command].join(' ');

  return runWithCode(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });
}
