export const writeLog = (
  messageId: string | number | undefined,
  type: string,
  message: unknown
): void =>
  console.log(`${new Date().toISOString()}/${messageId} ${type}: ${message}`);
