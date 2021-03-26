import { Telegraf } from 'telegraf'
const stream = require('stream');
const {promisify} = require('util');
import { createWriteStream } from 'fs'
import got from 'got'
import dotenv from 'dotenv'

dotenv.config()
const pipeline = promisify(stream.pipeline);

const helpMessage = `
<b>Commands</b>
Reply to your audio file or your youtube link with one of these commands

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
`

const bot: Telegraf = new Telegraf(process.env.TOKEN)

bot.on('text', (ctx) => {
  ctx.replyWithHTML('Bot under contruction... \n <b>@paramoNNNN</b> ')
})

console.log('Starting slowed+reverb bot')
bot.launch()