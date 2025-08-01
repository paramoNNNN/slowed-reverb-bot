import dotenv from "dotenv";
import type { Api, Bot, CommandContext, Context, RawApi } from "grammy";

import { getErrorLogs, log } from "../helpers/logger";

dotenv.config();

export const checkMessage = (
  ctx: CommandContext<Context>,
): boolean | RegExpMatchArray | null | undefined =>
  (ctx.update.message?.reply_to_message && "audio" in ctx.update.message.reply_to_message) ||
  (ctx.update.message?.reply_to_message &&
    "text" in ctx.update.message.reply_to_message &&
    ctx.update.message.reply_to_message.text?.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/,
    ));

export const splitMessage = (ctx: CommandContext<Context>, defaultValue: string): string => {
  const message = ctx.update.message?.text.split(" ");
  return message?.[1] ? message[1] : defaultValue;
};

export function sendMessage({
  bot,
  chatId,
  text,
  options,
}: {
  bot: Bot<Context, Api<RawApi>>;
  chatId: number;
  text: string;
  options: Parameters<typeof bot.api.sendMessage>[2];
}): void {
  bot.api
    .sendMessage(chatId, text, options)
    .catch((error) =>
      log.error(
        { chatId, text, options, error: getErrorLogs(error) },
        "Something went wrong while sending a message",
      ),
    );
}
