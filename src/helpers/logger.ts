import logger, { type LoggerOptions } from "pino";

export const getErrorLogs = (error: unknown) =>
  error instanceof Error
    ? {
        cause: error.cause,
        message: error.message,
        name: error.name,
        stack: error.stack,
      }
    : error;

const jsonLogger: LoggerOptions = {
  errorKey: "error",
  formatters: {
    log(object) {
      return {
        data: {
          ...object,
          ...(object.error instanceof Error
            ? { error: { ...object.error, stack: object.error.stack } }
            : {}),
        },
      };
    },
  },
  messageKey: "message",
  timestamp() {
    return `,"time":"${new Date().toISOString()}"`;
  },
};

const prettyLogger: LoggerOptions = {
  transport: {
    options: {
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss Z",
    },
    target: "pino-pretty",
  },
};

export const log = logger({
  level: "debug",
  ...(process.env.LOG_FORMAT === "json" ? jsonLogger : prettyLogger),
});
