import { type ExecOptions, run, runStreaming, runWithCode } from '../utils/shell.js';

export interface BuildOptions extends ExecOptions {
  /** Build arguments to pass to docker build */
  buildArgs?: Record<string, string>;
  /** Target stage for multi-stage builds */
  target?: string;
  /** Skip cache when building */
  noCache?: boolean;
  /** Platform to build for */
  platform?: string;
  /** Context directory for build */
  context?: string;
}

export interface ImageInfo {
  repository: string;
  tag: string;
  imageId: string;
  size: string;
  created: string;
}

/**
 * Pull a Docker image from registry
 * Uses streaming for real-time download progress
 */
export async function pullImage(
  image: string,
  options: ExecOptions & { platform?: string } = {},
): Promise<number> {
  const args = ['pull'];

  if (options.platform) {
    args.push('--platform', options.platform);
  }

  args.push(image);

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * Tag a Docker image
 */
export async function tagImage(
  source: string,
  target: string,
  options: ExecOptions = {},
): Promise<boolean> {
  const cmd = `docker tag ${source} ${target}`;
  const result = await runWithCode(cmd, options);
  return result.code === 0;
}

/**
 * Build a Docker image from a Dockerfile
 * Uses streaming for real-time build output
 */
export async function buildImage(
  dockerfile: string,
  tag: string,
  buildArgs?: Record<string, string>,
  options: BuildOptions = {},
): Promise<number> {
  const args = ['build', '-f', dockerfile, '-t', tag];

  // Add build arguments
  const allBuildArgs = { ...buildArgs, ...options.buildArgs };
  for (const [key, value] of Object.entries(allBuildArgs)) {
    args.push('--build-arg', `${key}=${value}`);
  }

  if (options.target) {
    args.push('--target', options.target);
  }

  if (options.noCache) {
    args.push('--no-cache');
  }

  if (options.platform) {
    args.push('--platform', options.platform);
  }

  // Context directory (defaults to current directory)
  args.push(options.context ?? '.');

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * Build a Docker image with the context being the Dockerfile's directory
 * Convenience function matching the bash pattern: docker build "$DIR" -t tag
 */
export async function buildImageFromDirectory(
  directory: string,
  tag: string,
  options: BuildOptions = {},
): Promise<number> {
  const args = ['build', directory, '-t', tag];

  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  if (options.target) {
    args.push('--target', options.target);
  }

  if (options.noCache) {
    args.push('--no-cache');
  }

  if (options.platform) {
    args.push('--platform', options.platform);
  }

  return runStreaming('docker', args, {
    cwd: options.cwd,
    env: options.env,
  });
}

/**
 * List Docker images
 */
export async function listImages(filter?: string, options: ExecOptions = {}): Promise<ImageInfo[]> {
  const formatString = '{{.Repository}}|{{.Tag}}|{{.ID}}|{{.Size}}|{{.CreatedAt}}';
  let cmd = `docker images --format '${formatString}'`;

  if (filter) {
    cmd += ` --filter 'reference=${filter}'`;
  }

  const result = await run(cmd, options);
  const lines = result.stdout.trim().split('\n').filter(Boolean);

  return lines.map((line) => {
    const [repository, tag, imageId, size, created] = line.split('|');
    return {
      repository: repository ?? '',
      tag: tag ?? '',
      imageId: imageId ?? '',
      size: size ?? '',
      created: created ?? '',
    };
  });
}

/**
 * Check if an image exists locally
 */
export async function imageExists(image: string, options: ExecOptions = {}): Promise<boolean> {
  const cmd = `docker image inspect ${image}`;
  const result = await runWithCode(cmd, options);
  return result.code === 0;
}

/**
 * Remove a Docker image
 */
export async function removeImage(
  image: string,
  options: ExecOptions & { force?: boolean } = {},
): Promise<boolean> {
  const forceFlag = options.force ? '-f' : '';
  const cmd = `docker rmi ${forceFlag} ${image}`.trim();
  const result = await runWithCode(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });
  return result.code === 0;
}

/**
 * Remove dangling images
 */
export async function pruneImages(
  options: ExecOptions & { all?: boolean } = {},
): Promise<{ spaceClaimed: string }> {
  const flags = ['-f'];
  if (options.all) {
    flags.push('-a');
  }

  const cmd = `docker image prune ${flags.join(' ')}`;
  const result = await run(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });

  // Parse space reclaimed from output
  const match = result.stdout.match(/Total reclaimed space:\s*(.+)/);
  const spaceClaimed = match?.[1]?.trim() ?? '0B';

  return { spaceClaimed };
}

/**
 * Get the digest of an image
 */
export async function getImageDigest(
  image: string,
  options: ExecOptions = {},
): Promise<string | null> {
  const cmd = `docker inspect --format='{{index .RepoDigests 0}}' ${image}`;
  const result = await runWithCode(cmd, options);

  if (result.code !== 0 || !result.stdout.trim()) {
    return null;
  }

  return result.stdout.trim();
}
