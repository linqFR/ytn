/**
 * @constant logger
 * @description Standardized POSIX-compliant logger for the CLI.
 * 
 * Rules:
 * - Use 'success' for actual business data (mapped to stdout).
 * - Use 'info', 'warn', and 'error' for metadata, help, and diagnostics (mapped to stderr).
 */
export const logger = {
  /** 
   * Outputs business data to stdout. 
   * Perfect for piping: 'cmd | jq'
   */
  success: (data: unknown) => {
    const out = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
    process.stdout.write(out + "\n");
  },

  /** 
   * Outputs information or help to stderr.
   * Does not pollute the data stream.
   */
  info: (msg: string) => {
    process.stderr.write(`\x1b[34m(info)\x1b[0m ${msg}\n`);
  },

  /** 
   * Outputs warnings to stderr.
   */
  warn: (msg: string) => {
    process.stderr.write(`\x1b[33m(warn)\x1b[0m ${msg}\n`);
  },

  /** 
   * Outputs errors to stderr.
   */
  error: (msg: string) => {
    process.stderr.write(`\x1b[31m(error) ${msg}\x1b[0m\n`);
  },
};
