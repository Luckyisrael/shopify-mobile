/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  maxLogs: number;
}

/**
 * Logger for SDK debugging
 */
export class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled: false,
      level: LogLevel.INFO,
      maxLogs: 1000,
      ...config,
    };
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.config.enabled || level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    // Add to logs
    this.logs.push(entry);

    // Trim if exceeds max
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Console output
    this.consoleLog(entry);
  }

  /**
   * Output to console
   */
  private consoleLog(entry: LogEntry): void {
    const prefix = `[Shopify SDK ${this.getLevelName(entry.level)}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(message, entry.data);
        break;
    }
  }

  /**
   * Get level name
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}
