import { CTX } from "../types";

export const checkMessage = (
  ctx: CTX
): boolean | RegExpMatchArray | null | undefined =>
  (ctx.update.message.reply_to_message &&
    "audio" in ctx.update.message.reply_to_message) ||
  (ctx.update.message.reply_to_message &&
    "text" in ctx.update.message.reply_to_message &&
    ctx.update.message.reply_to_message.text.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/
    ));

export const splitMessage = <T extends string | string[]>(
  ctx: CTX,
  defaultValue: T
): T | string => {
  const message = ctx.update.message.text.split(" ");
  return message.length > 1 ? message[1] : defaultValue;
};
