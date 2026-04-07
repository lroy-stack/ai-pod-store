/**
 * MCP Logger with runtime-adjustable log level
 * Supports MCP logging/setLevel notification
 */

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

class Logger {
  private currentLevel: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.currentLevel = level;
    console.info(`[MCP Logger] Log level set to: ${level}`);
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warning(message: string, data?: Record<string, unknown>): void {
    this.log('warning', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.currentLevel]) {
      return; // Skip logs below current level
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    // Output to console based on level
    const output = JSON.stringify(logEntry);
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warning':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}

// Singleton logger instance
export const logger = new Logger();
