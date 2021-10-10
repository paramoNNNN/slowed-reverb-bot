import type * as tt from "telegraf/src/telegram-types";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";

import { writeLog } from "../helpers/logger";
import { CTX } from "../types";

const bot: Telegraf = new Telegraf(process.env.TOKEN);

dotenv.config();

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

type SendMessageParams = (
  chatId: number,
  text: string,
  options?: tt.ExtraReplyMessage
) => void;

export const sendMessage: SendMessageParams = (chatId, text, options): void => {
  bot.telegram
    .sendMessage(chatId, text, options)
    .catch((e) =>
      writeLog(
        options
          ? `messageId: ${options.reply_to_message_id}`
          : `chatId: ${chatId}`,
        "Error",
        JSON.stringify(e)
      )
    );
};
