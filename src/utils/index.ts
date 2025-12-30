export { logger, setVerbose, isVerbose, type Logger } from './logger.js';
export {
  run,
  runInDir,
  runStreaming,
  runWithCode,
  commandExists,
  getLastLine,
  cleanOutput,
  type ExecResult,
  type ExecOptions,
} from './shell.js';
