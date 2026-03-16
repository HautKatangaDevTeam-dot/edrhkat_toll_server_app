const formatMessage = (level: string, message: string) =>
  `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;

const logger = {
  info: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(formatMessage('info', message), meta ?? '');
  },
  warn: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message), meta ?? '');
  },
  error: (message: string, error?: unknown) => {
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message));
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }
};

export default logger;
