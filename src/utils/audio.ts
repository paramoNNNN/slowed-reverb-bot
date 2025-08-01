import type { Readable } from "node:stream";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";

import { writeLog } from "../helpers/logger";

interface DownloadAudioParams {
  audioStream?: Readable;
  audioUrl?: string;
  messageId: string;
}

export const downloadAudio = ({
  audioStream,
  audioUrl,
  messageId,
}: DownloadAudioParams): Promise<{ data: string | NodeJS.ArrayBufferView }> => {
  return new Promise((resolve, reject) => {
    if (audioStream !== undefined) {
      ffmpeg(audioStream)
        .audioBitrate(320)
        .save(`temp/temp_${messageId}.mp3`)
        .on("end", () => {
          writeLog(messageId, "Downloaded", audioUrl);
          resolve({ data: "done" });
        })
        .on("error", (e) => {
          reject(e);
        });
    } else if (audioUrl !== undefined) {
      axios
        .get(`https://api.telegram.org/file/bot${process.env.TOKEN}/${audioUrl}`, {
          responseType: "arraybuffer",
        })
        .then((file) => {
          writeLog(messageId, "Downloaded", audioUrl);
          resolve(file);
        })
        .catch((error) => reject(error));
    }
  });
};
