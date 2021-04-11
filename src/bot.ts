import { Telegraf } from "telegraf";
import { addEffectQueue } from "./queues";
import dotenv from "dotenv";

dotenv.config();

const helpMessage = `
<b>Commands</b>
Reply to your audio file with one of these commands

- <code>/slowedreverb</code>
Adjust the audio speed (pitch and tempo together) with reverb effect.
<b>Default value if none given:</b> 0.75
<b>Example:</b> <code>/slowedreverb 0.8</code>

- <code>/speed</code>
Adjust the audio speed (pitch and tempo together).
<b>Default value if none given:</b> 0.75
<b>Example:</b> <code>/speed 0.8</code>

- <code>/reverb</code>
Add reverberation to the audio using the ‘freeverb’ algorithm.
<b>Default values if none given:</b> reverberance (50%) HF-damping (50%) room-scale (100%) stereo-depth (100%) pre-delay (20ms) wet-gain (0dB)
<b>Example:</b> <code>/reverb 50 50 100 100 20 0</code>

- <code>/pitch</code>
Change the audio pitch (but not tempo).
<b>Default value if none given:</b> 500
<b>Example:</b> <code>/pitch 200</code>

- <code>/tempo</code>
Change the audio playback speed but not its pitch.
shift gives the pitch shift as positive or negative 'cents' (i.e. 100ths of a semitone)
<b>Default value if none given:</b> 0.8
<b>Example:</b> <code>/tempo 0.9</code>
`;

const bot: Telegraf = new Telegraf(process.env.TOKEN);

bot.start((ctx) => ctx.replyWithHTML(helpMessage));
bot.help((ctx) => ctx.replyWithHTML(helpMessage));

// TODO: Set a proper type to ctx
const checkMessage = (ctx: any) =>
  ctx.update.message.reply_to_message &&
  "audio" in ctx.update.message.reply_to_message;

// TODO: Set a proper type to ctx
const splitMessage = (ctx: any, defaultValue: string | string[]) => {
  const message = ctx.update.message.text.split(" ");
  return message.length > 1 ? message[1] : defaultValue;
};

// TODO: Set a proper type to ctx
const addQueue = (
  ctx: any,
  speed?: string,
  reverb?: string[],
  pitch?: string,
  tempo?: string
) => {
  const message = ctx.update.message.reply_to_message;
  if (message && "audio" in message) {
    addEffectQueue.add("process", {
      audio: message.audio,
      messageId: ctx.message.message_id,
      chatId: ctx.chat.id,
      speed,
      reverb,
      pitch,
      tempo,
    });
  }
};

bot
  .command("slowedreverb", (ctx) => {
    if (checkMessage(ctx)) {
      const speed = splitMessage(ctx, "0.75");
      addQueue(ctx, speed, ["50", "50", "100", "100", "20", "0"]);
    }
  })
  .catch(() => {});

bot.command("speed", (ctx) => {
  if (checkMessage(ctx)) {
    const speed = splitMessage(ctx, "0.75");
    addQueue(ctx, speed);
  }
});

bot.command("reverb", (ctx) => {
  if (checkMessage(ctx)) {
    let reverb = ctx.update.message.text.split(" ");
    if (reverb.length > 0) reverb.shift();
    else reverb = ["50", "50", "100", "100", "20", "0"];
    addQueue(ctx, undefined, reverb);
  }
});

bot.command("pitch", (ctx) => {
  if (checkMessage(ctx)) {
    const pitch = splitMessage(ctx, "500");
    addQueue(ctx, undefined, undefined, pitch);
  }
});

bot.command("tempo", (ctx) => {
  if (checkMessage(ctx)) {
    const tempo = splitMessage(ctx, "0.8");
    addQueue(ctx, undefined, undefined, undefined, tempo);
  }
});

console.log("Starting slowed+reverb bot");
bot.launch();
