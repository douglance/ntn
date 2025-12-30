import { type SpawnOptions, exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  timeout?: number;
}

/**
 * Execute a shell command and return stdout/stderr
 */
export async function run(cmd: string, options: ExecOptions = {}): Promise<ExecResult> {
  logger.command(cmd);

  const result = await execAsync(cmd, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024, // 10MB default
    timeout: options.timeout,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Execute a command in a specific directory
 */
export async function runInDir(dir: string, cmd: string): Promise<string> {
  const { stdout } = await run(cmd, { cwd: dir });
  return stdout.trim();
}

/**
 * Execute a command and stream output to console
 */
export async function runStreaming(
  cmd: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<number> {
  logger.command(`${cmd} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}

/**
 * Run a command and capture output, returning exit code
 */
export async function runWithCode(
  cmd: string,
  options: ExecOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  logger.command(cmd);

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
        timeout: options.timeout,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          code: error?.code ?? 0,
        });
      },
    );
  });
}

/**
 * Check if a command exists
 */
export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await run(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the last line of stdout (useful for extracting values)
 */
export function getLastLine(output: string): string {
  const lines = output.trim().split('\n');
  return lines[lines.length - 1]?.trim() ?? '';
}

/**
 * Remove carriage returns (useful for docker output)
 */
export function cleanOutput(output: string): string {
  return output.replace(/\r\n/g, '\n').replace(/\r/g, '').trim();
}
