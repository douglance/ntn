import chalk from 'chalk';

export interface Logger {
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
  step: (message: string) => void;
  command: (cmd: string) => void;
}

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export const logger: Logger = {
  /** Info message with blue prefix */
  info: (message: string) => {
    console.log(chalk.blue('=='), message);
  },

  /** Success message with green checkmark */
  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },

  /** Warning message with yellow prefix */
  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },

  /** Error message with red prefix */
  error: (message: string) => {
    console.error(chalk.red('✗'), message);
  },

  /** Debug message (only shown in verbose mode) */
  debug: (message: string) => {
    if (verboseMode) {
      console.log(chalk.gray('DEBUG:'), message);
    }
  },

  /** Step message for workflow phases */
  step: (message: string) => {
    console.log(chalk.cyan('→'), message);
  },

  /** Command being executed (only in verbose mode) */
  command: (cmd: string) => {
    if (verboseMode) {
      console.log(chalk.dim('$'), chalk.dim(cmd));
    }
  },
};

export default logger;
