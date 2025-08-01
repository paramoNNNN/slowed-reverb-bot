import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { Bot, InputFile } from "grammy";
import NodeID3 from "node-id3";
import type { Logger } from "pino";
import youtubedl from "ytdl-core";

import { getErrorLogs, log } from "./helpers/logger";
import { downloadAudio, sendMessage } from "./utils";

dotenv.config();

const bot = new Bot(process.env.TOKEN);

const bullmqOptions = {
  connection: { host: "localhost", port: 6379 },
};
export const addEffectQueue = new Queue("AddEffect", bullmqOptions);

type ExecuteSoxCommandParams = {
  log: Logger;
  messageId: string | number;
  inputFile: string;
  outputFile: string;
  speed?: string;
  reverb?: string[];
  pitch?: string;
  tempo?: string;
};
function executeSoxCommand({
  log,
  messageId,
  inputFile,
  outputFile,
  speed,
  reverb,
  pitch,
  tempo,
}: ExecuteSoxCommandParams) {
  log.info({ messageId, inputFile, outputFile }, "Starting adding effects");

  const commands: Array<string> = [];
  if (speed) commands.push("speed", speed);
  if (reverb) commands.push("reverb", reverb.join(" "));
  if (pitch) commands.push("pitch", pitch);
  if (tempo) commands.push("tempo", tempo);
  const soxCommand = `sox -N -V1 --ignore-length -G ${inputFile} -C 320 -r 44100 -b 16 -c 2 -C 8 ${outputFile}`;

  return new Promise<void>((resolve, reject) => {
    exec(`${soxCommand} ${commands.join(" ")}`, async (error, _, stderr) => {
      if (error || stderr) {
        reject({ error, stderr });
      }
      log.info({ messageId, inputFile, outputFile }, "Added effects");
      resolve();
    });
  });
}

type ConvertAudioToMp3Params = {
  messageId: string;
  telegramFile: Awaited<ReturnType<typeof bot.api.getFile>>;
  file: NodeJS.ArrayBufferView;
  fileName: string;
};
async function convertAudioToMp3({
  messageId,
  telegramFile,
  file,
  fileName,
}: ConvertAudioToMp3Params) {
  const stream = Readable.from([file]);
  const newTempFileName = `${fileName.split(".").slice(0, -1).join(".")}.mp3`;
  try {
    const newFileName = await new Promise<string>((resolve, reject) => {
      ffmpeg(stream)
        .addOption(["-vn", "-ar 44100", "-ac 2", "-b:a 320k"])
        .save(newTempFileName)
        .on("end", () => {
          log.info({ messageId, telegramFile, newTempFileName }, "Converted audio file to mp3");
          if (fileName !== newTempFileName) {
            log.info({ messageId, fileName }, "Removing old file");
            fs.unlinkSync(fileName);
          }
          resolve(newTempFileName);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
    return newFileName;
  } catch (error) {
    log.error(
      { messageId, telegramFile, error: getErrorLogs(error) },
      "Something went wrong while converting audio file to mp3",
    );
    throw error;
  }
}

// TODO: this whole worker thing needs some clean up
const addEffectWorker = new Worker(
  "AddEffect",
  async (job) => {
    const { audio, messageId, chatId, speed, reverb, pitch, tempo } = job.data;

    let artist: string;
    let title: string;
    let tempAudioFileName = `temp/${messageId}_${String(audio.file_name).replace(/[^a-z0-9.]/gi, "")}`;
    let file: NodeJS.ArrayBufferView | undefined;
    let telegramFile: Awaited<ReturnType<typeof bot.api.getFile>> | undefined;

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
      await downloadAudio({ audioStream, fileName: tempAudioFileName, messageId });
    } else {
      artist = (audio.performer || "unknown artist").replace("/", "-");
      title = (audio.title || "untitled").replace("/", "-");

      telegramFile = await bot.api.getFile(audio.file_id);
      if (telegramFile.file_path) {
        file = (await downloadAudio({ audioUrl: telegramFile.file_path, messageId })).data;
        fs.writeFile(tempAudioFileName, file, (error) => {
          if (error) {
            log.error({ messageId, error: getErrorLogs(error) }, "Error in writing file");
          }
        });
      } else {
        throw Error("No file_path in audio file");
      }
    }

    sendMessage({
      bot,
      chatId,
      text: "Adding effects...",
      options: {
        reply_to_message_id: messageId,
      },
    });

    if (tempAudioFileName.split(".").at(-1) !== "mp3") {
      log.info("Downloaded file is not in mp3 format, converting it to mp3");
      if (file && telegramFile) {
        const convertedFileName = await convertAudioToMp3({
          fileName: tempAudioFileName,
          messageId,
          file,
          telegramFile,
        });
        tempAudioFileName = convertedFileName;
      } else {
        throw Error("No file or telegram file");
      }
    }

    const soxOutputFile = `temp/${messageId}.flac`;
    await executeSoxCommand({
      log,
      messageId,
      inputFile: tempAudioFileName,
      outputFile: soxOutputFile,
      pitch,
      reverb,
      speed,
      tempo,
    });

    const originalDuration = await getAudioDurationInSeconds(tempAudioFileName);
    const duration = await getAudioDurationInSeconds(soxOutputFile);
    if (duration < originalDuration / 2) {
      log.warn(
        { messageId, originalDuration, duration },
        "Something wrong with the processed file, converting it to mp3 and adding effects again",
      );
      if (file && telegramFile) {
        const convertedFileName = await convertAudioToMp3({
          fileName: tempAudioFileName,
          messageId,
          file,
          telegramFile,
        });
        tempAudioFileName = convertedFileName;
        await executeSoxCommand({
          log,
          messageId,
          inputFile: tempAudioFileName,
          outputFile: soxOutputFile,
          pitch,
          reverb,
          speed,
          tempo,
        });
      } else {
        throw Error("No file or telegram file");
      }
    }

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
      ...NodeID3.read(tempAudioFileName),
      artist,
      title,
    };
    NodeID3.write(tags, soxOutputFile);

    fs.rename(soxOutputFile, `output/${artist} - ${title}.flac`, async (error) => {
      if (error) {
        return log.info(
          { messageId, artist, title, error: getErrorLogs(error) },
          "Error in renaming file",
        );
      }

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
          log.info({ messageId, artist, title }, "Sent audio file");
          fs.unlinkSync(`output/${artist} - ${title}.flac`);
          fs.unlinkSync(tempAudioFileName);
        })
        .catch((error) => {
          log.error(
            { messageId, artist, title, error: getErrorLogs(error) },
            "Error in sending audio file",
          );
        });
    });
  },
  bullmqOptions,
);

addEffectWorker.on("failed", (job, error) => {
  const { chatId, messageId } = job.data;

  log.error({ messageId, error: getErrorLogs(error) }, "Error in prcessing queue");
  sendMessage({
    bot,
    chatId,
    text: `Something unexpected happend \n code: ${messageId}`,
    options: {
      reply_to_message_id: messageId,
    },
  });
});
