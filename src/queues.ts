import { Queue, Worker } from "bullmq";
import { exec } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import { getAudioDurationInSeconds } from "get-audio-duration";
import NodeID3 from "node-id3";
import { Telegraf } from "telegraf";
import youtubedl from "ytdl-core";

import { writeLog } from "./helpers/logger";
import { downloadAudio, sendMessage } from "./utils";

dotenv.config();

const bot: Telegraf = new Telegraf(process.env.TOKEN);
const bullmqOptions = {
  connection: { host: "localhost", port: 6379 },
};
export const addEffectQueue = new Queue("AddEffect", bullmqOptions);

const addEffectWorker = new Worker(
  "AddEffect",
  async (job) => {
    const { audio, messageId, chatId, speed, reverb, pitch, tempo } = job.data;

    let artist: string;
    let title: string;

    sendMessage(chatId, "Downloading...", {
      reply_to_message_id: messageId,
    });

    if (typeof audio === "string") {
      const info = await youtubedl.getInfo(audio);
      artist = (info.videoDetails.media.artist || "unknown artist").replace("/", "-");
      title = (info.videoDetails.media.song || "untitled").replace("/", "-");
      const audioStream = youtubedl(audio, { filter: "audioonly" });
      await downloadAudio({ audioStream, audioUrl: audio, messageId });
    } else {
      artist = (audio.performer || "unknown artist").replace("/", "-");
      title = (audio.title || "untitled").replace("/", "-");

      const url = await bot.telegram.getFileLink(audio.file_id);
      const file = await downloadAudio({ audioUrl: url.href, messageId });
      fs.writeFile(`temp/temp_${messageId}.mp3`, file.data, (err) => {
        if (err) return writeLog(messageId, "Error", err);
      });
    }

    const commands = [];
    if (speed) commands.push("speed", speed);
    if (reverb) commands.push("reverb", reverb.join(" "));
    if (pitch) commands.push("pitch", pitch);
    if (tempo) commands.push("tempo", tempo);
    const soxCommand = `sox -N -V1 --ignore-length -G temp/temp_${messageId}.mp3 -C 320 -r 44100 -b 24 -c 2 temp/temp_${messageId}.tmp.mp3`;

    sendMessage(chatId, "Adding effects...", {
      reply_to_message_id: messageId,
    });

    exec(`${soxCommand} ${commands.join(" ")}`, (error, _, stderr) => {
      if (error || stderr) {
        return sendMessage(chatId, `Something unexpected happend \n code: ${messageId}`, {
          reply_to_message_id: messageId,
        });
      }
      writeLog(messageId, "Added effects", `${artist} - ${title}`);

      artist = `${artist.toLowerCase()}`;
      title = title.toLowerCase();
      if (speed) {
        if (reverb) {
          if (parseFloat(speed) > 1) title = `${title} ${"ﾉ sped up + reverb ﾉ"}`;
          else title = `${title} ${"ﾉ slowed + reverb ﾉ"}`;
        } else if (parseFloat(speed) > 1) title = `${title} ${"ﾉ sped up ﾉ"}`;
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

          const duration = await getAudioDurationInSeconds(`output/${artist} - ${title}.mp3`);

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
              },
            )
            .then(() => {
              writeLog(messageId, "Sent Audio", `${artist} - ${title}`);
              fs.unlinkSync(`output/${artist} - ${title}.mp3`);
              fs.unlinkSync(`temp/temp_${messageId}.mp3`);
            });
        },
      );
    });
  },
  bullmqOptions,
);

addEffectWorker.on("failed", (job, err) => {
  const { chatId, messageId } = job.data;

  writeLog(messageId, "Error", JSON.stringify(err));
  sendMessage(chatId, `Something unexpected happend \n code: ${messageId}`, {
    reply_to_message_id: messageId,
  });
});
