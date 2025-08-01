import type { Readable } from "node:stream";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";

import { getErrorLogs, log } from "../helpers/logger";

type DownloadAudioParams = { messageId: string } & (
  | { audioStream: Readable }
  | { audioUrl: string }
);

export function downloadAudio({
  messageId,
  ...params
}: DownloadAudioParams): Promise<{ data: string | NodeJS.ArrayBufferView }> {
  return new Promise((resolve, reject) => {
    if ("audioStream" in params) {
      log.info({ messageId }, `Starting to process audio file`);
      ffmpeg(params.audioStream)
        .audioBitrate(320)
        .save(`temp/temp_${messageId}.mp3`)
        .on("end", () => {
          log.info({ messageId }, `Processed audio file`);
          resolve({ data: "done" });
        })
        .on("error", (error) => {
          log.error(
            { messageId, error: getErrorLogs(error) },
            "Something went wrong while processing audio file",
          );
          reject(error);
        });
    } else if ("audioUrl" in params) {
      log.info({ messageId, audioUrl: params.audioUrl }, `Starting to download audio file`);
      axios
        .get(`https://api.telegram.org/file/bot${process.env.TOKEN}/${params.audioUrl}`, {
          responseType: "arraybuffer",
        })
        .then((file) => {
          log.info({ messageId, audioUrl: params.audioUrl }, `Downloaded file`);
          resolve(file);
        })
        .catch((error) => {
          log.error(
            { messageId, error: getErrorLogs(error) },
            "Something went wrong while downloading audio file",
          );
          reject(error);
        });
    }
  });
}
