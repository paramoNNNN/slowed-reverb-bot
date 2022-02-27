<h1 align="center">Slowed + Reverb Telegram Bot</h1>

<div align="center">
  <strong>Fully written in TypeScript with
    <a href="https://github.com/telegraf/telegraf">Telegraf</a>
    and
    <a href="https://github.com/taskforcesh/bullmq">BullMQ</a>
  </strong>
</div>

# Setup

### Requirements

- [Node](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/)
- [Redis](https://redis.io/)
- [FFmpeg](https://www.ffmpeg.org/)
- [SoX](https://sox.sourceforge.io)

### Configuration

Set your bot TOKEN in `.env`

### Install and build

- Install packages: `yarn`

- build and run the bot: `yarn tsc && node build/bot.js`
