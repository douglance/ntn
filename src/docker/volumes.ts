import { type ExecOptions, run, runWithCode } from '../utils/shell.js';

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
}

/**
 * List Docker volumes, optionally filtered by prefix
 */
export async function getVolumes(
  prefix?: string,
  options: ExecOptions = {},
): Promise<VolumeInfo[]> {
  const formatString = '{{.Name}}|{{.Driver}}|{{.Mountpoint}}';
  const cmd = `docker volume ls --format '${formatString}'`;

  const result = await run(cmd, options);
  const lines = result.stdout.trim().split('\n').filter(Boolean);

  const volumes: VolumeInfo[] = lines.map((line) => {
    const [name, driver, mountpoint] = line.split('|');
    return {
      name: name ?? '',
      driver: driver ?? '',
      mountpoint: mountpoint ?? '',
    };
  });

  if (prefix) {
    return volumes.filter((volume) => volume.name.startsWith(prefix));
  }

  return volumes;
}

/**
 * Get detailed information about a specific volume
 */
export async function inspectVolume(
  volumeName: string,
  options: ExecOptions = {},
): Promise<Record<string, unknown> | null> {
  const cmd = `docker volume inspect ${volumeName}`;

  const result = await runWithCode(cmd, options);

  if (result.code !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>[];
    return parsed[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Remove unused Docker volumes
 */
export async function pruneVolumes(
  options: ExecOptions & { force?: boolean } = {},
): Promise<{ spaceClaimed: string; volumesRemoved: string[] }> {
  const forceFlag = options.force !== false ? '-f' : '';
  const cmd = `docker volume prune ${forceFlag}`.trim();

  const result = await run(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });

  // Parse the output to extract information
  const lines = result.stdout.split('\n');
  const volumesRemoved: string[] = [];
  let spaceClaimed = '0B';

  for (const line of lines) {
    if (line.startsWith('Total reclaimed space:')) {
      spaceClaimed = line.replace('Total reclaimed space:', '').trim();
    } else if (line.trim() && !line.includes('Deleted') && !line.includes('Total')) {
      volumesRemoved.push(line.trim());
    }
  }

  return { spaceClaimed, volumesRemoved };
}

/**
 * Remove specific Docker volumes
 */
export async function removeVolumes(
  volumes: string[],
  options: ExecOptions & { force?: boolean } = {},
): Promise<{ removed: string[]; failed: string[] }> {
  const removed: string[] = [];
  const failed: string[] = [];
  const forceFlag = options.force ? '-f' : '';

  for (const volume of volumes) {
    const cmd = `docker volume rm ${forceFlag} ${volume}`.trim();
    const result = await runWithCode(cmd, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout,
    });

    if (result.code === 0) {
      removed.push(volume);
    } else {
      failed.push(volume);
    }
  }

  return { removed, failed };
}

/**
 * Create a Docker volume
 */
export async function createVolume(
  volumeName: string,
  options: ExecOptions & { driver?: string; labels?: Record<string, string> } = {},
): Promise<boolean> {
  const parts = ['docker', 'volume', 'create'];

  if (options.driver) {
    parts.push('--driver', options.driver);
  }

  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      parts.push('--label', `${key}=${value}`);
    }
  }

  parts.push(volumeName);

  const cmd = parts.join(' ');
  const result = await runWithCode(cmd, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
  });

  return result.code === 0;
}

/**
 * Check if a volume exists
 */
export async function volumeExists(
  volumeName: string,
  options: ExecOptions = {},
): Promise<boolean> {
  const cmd = `docker volume inspect ${volumeName}`;
  const result = await runWithCode(cmd, options);
  return result.code === 0;
}
