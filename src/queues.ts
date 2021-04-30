import { Telegraf } from "telegraf";
import { Queue, Worker } from "bullmq";
import axios from "axios";
import fs from "fs";
import { exec } from "child_process";
import NodeID3 from "node-id3";
import { getAudioDurationInSeconds } from "get-audio-duration";
import dotenv from "dotenv";
import { writeLog } from "./helpers/logger";

dotenv.config();

const bot: Telegraf = new Telegraf(process.env.TOKEN);
export const addEffectQueue = new Queue("AddEffect");

const addEffectWorker = new Worker("AddEffect", async (job) => {
  const { audio, messageId, chatId, speed, reverb, pitch, tempo } = job.data;
  let artist: string = (audio.performer || "Unknown Artist").replace("/", "-");
  let title: string = (audio.title || "untiled").replace("/", "-");

  bot.telegram
    .sendMessage(chatId, "Downloading...", { reply_to_message_id: messageId })
    .catch((e) => writeLog(messageId, "Error", JSON.stringify(e)));

  bot.telegram
    .getFileLink(audio.file_id)
    .then((url) =>
      axios.get(url.href, { responseType: "arraybuffer" }).then((file) =>
        fs.writeFile(`temp/temp_${messageId}.mp3`, file.data, (err) => {
          if (err) return writeLog(messageId, "Error", err);
          writeLog(messageId, "Downloaded", `${artist} - ${title}`);

          const commands = [];
          if (speed) commands.push("speed", speed);
          if (reverb) commands.push("reverb", reverb.join(" "));
          if (pitch) commands.push("pitch", pitch);
          if (tempo) commands.push("tempo", tempo);
          const soxCommand = `sox -N -V1 --ignore-length -G temp/temp_${messageId}.mp3 -C 320 -r 44100 -b 24 -c 2 temp/temp_${messageId}.tmp.mp3`;

          bot.telegram
            .sendMessage(chatId, "Adding effects...", {
              reply_to_message_id: messageId,
            })
            .catch((e) => writeLog(messageId, "Error", JSON.stringify(e)));

          exec(`${soxCommand} ${commands.join(" ")}`, (error, _, stderr) => {
            if (error || stderr)
              return bot.telegram.sendMessage(
                chatId,
                `Something unexpected happend \n code: ${messageId}`,
                { reply_to_message_id: messageId }
              );
            writeLog(messageId, "Added effects", `${artist} - ${title}`);

            artist = `${artist.toLowerCase()}`;
            title = title.toLowerCase();
            if (speed) {
              if (reverb) {
                if (parseFloat(speed) > 1)
                  title = `${title} ${"ﾉ sped up + reverb ﾉ"}`;
                else title = `${title} ${"ﾉ slowed + reverb ﾉ"}`;
              } else if (parseFloat(speed) > 1)
                title = `${title} ${"ﾉ sped up ﾉ"}`;
              else title = `${title} ${"ﾉ slowed ﾉ"}`;
            }

            const tags = {
              ...NodeID3.read(`temp/temp_${messageId}.mp3`),
              artist,
              title,
            };

            NodeID3.write(tags, `temp/temp_${messageId}.tmp.mp3`);
            fs.rename(
              `temp/temp_${messageId}.tmp.mp3`,
              `output/${artist} - ${title}.mp3`,
              async (err) => {
                if (err) return writeLog(messageId, "Error", err);

                const duration = await getAudioDurationInSeconds(
                  `output/${artist} - ${title}.mp3`
                );

                bot.telegram.sendChatAction(chatId, "upload_voice");
                bot.telegram
                  .sendAudio(
                    chatId,
                    { source: `output/${artist} - ${title}.mp3` },
                    {
                      reply_to_message_id: messageId,
                      performer: artist,
                      title: title,
                      duration,
                    }
                  )
                  .then(() => {
                    writeLog(messageId, "Sent Audio", `${artist} - ${title}`);
                    fs.unlinkSync(`output/${artist} - ${title}.mp3`);
                    fs.unlinkSync(`temp/temp_${messageId}.mp3`);
                  });
              }
            );
          });
        })
      )
    )
    .catch((err) => writeLog(messageId, "Error", JSON.stringify(err)));
});

addEffectWorker.on("failed", (job, err) => {
  const { chatId, messageId } = job.data;

  writeLog(messageId, "Error", JSON.stringify(err));
  bot.telegram.sendMessage(
    chatId,
    `Something unexpected happend \n code: ${messageId}`,
    { reply_to_message_id: messageId }
  );
});
