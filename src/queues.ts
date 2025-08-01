import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { Bot, InputFile } from "grammy";
import NodeID3 from "node-id3";
import youtubedl from "ytdl-core";

import { writeLog } from "./helpers/logger";
import { downloadAudio, sendMessage } from "./utils";

dotenv.config();

const bot = new Bot(process.env.TOKEN);

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

    sendMessage({
      bot,
      chatId,
      text: "Downloading...",
      options: {
        reply_to_message_id: messageId,
      },
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

      const url = await bot.api.getFile(audio.file_id);
      const file = await downloadAudio({ audioUrl: url.file_path, messageId });
      fs.writeFile(`temp/temp_${messageId}.mp3`, file.data, (err) => {
        if (err) return writeLog(messageId, "Error", err);
      });
    }

    const commands = [];
    if (speed) commands.push("speed", speed);
    if (reverb) commands.push("reverb", reverb.join(" "));
    if (pitch) commands.push("pitch", pitch);
    if (tempo) commands.push("tempo", tempo);
    const soxCommand = `sox -N -V1 --ignore-length -G temp/temp_${messageId}.mp3 -C 320 -r 44100 -b 16 -c 2 -C 8 temp/temp_${messageId}.tmp.flac`;

    sendMessage({
      bot,
      chatId,
      text: "Adding effects...",
      options: {
        reply_to_message_id: messageId,
      },
    });

    exec(`${soxCommand} ${commands.join(" ")}`, (error, _, stderr) => {
      if (error || stderr) {
        console.log(error);
        console.log(stderr);
        return sendMessage({
          bot,
          chatId,
          text: `Something unexpected happend \n code: ${messageId}`,
          options: {
            reply_to_message_id: messageId,
          },
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
      NodeID3.write(tags, `temp/temp_${messageId}.tmp.flac`);

      fs.rename(
        `temp/temp_${messageId}.tmp.flac`,
        `output/${artist} - ${title}.flac`,
        async (err) => {
          if (err) return writeLog(messageId, "Error", err);

          const duration = await getAudioDurationInSeconds(`output/${artist} - ${title}.flac`);

          const audioFilePath = path.join(__dirname, "../output", `${artist} - ${title}.flac`);
          const file = new InputFile(fs.readFileSync(audioFilePath));
          bot.api.sendChatAction(chatId, "upload_voice");
          bot.api
            .sendAudio(chatId, file, {
              reply_to_message_id: messageId,
              performer: artist,
              title: title,
              duration,
            })
            .then(() => {
              writeLog(messageId, "Sent Audio", `${artist} - ${title}`);
              fs.unlinkSync(`output/${artist} - ${title}.flac`);
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
  sendMessage({
    bot,
    chatId,
    text: `Something unexpected happend \n code: ${messageId}`,
    options: {
      reply_to_message_id: messageId,
    },
  });
});
