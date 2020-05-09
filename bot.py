import os
import time
import telepot
import asyncio
from threading import Thread
from tasks import app, addEffect
from telepot.aio.loop import MessageLoop

if not os.path.exists('temp'):
  os.makedirs('temp')
if not os.path.exists('outputs'):
  os.makedirs('outputs')

worker_name = ''
total_workers = 0
celery_inspect = app.control.inspect()
celery_stats = celery_inspect.stats()
if celery_stats:
  worker_name = list(celery_stats.keys())[0]
  total_workers = celery_stats[worker_name]['pool']['max-concurrency']
else:
  raise Exception('Celery worker\'s not running')

helpMessage = '''
*Commands*
Reply to your audio file or your youtube link with one of these commands

- `/slowedreverb`
Adjust the audio speed (pitch and tempo together) with reverb effect.
*Default value if none given:* 0.75
*Example:* `/slowedreverb 0.8`

- `/speed`
Adjust the audio speed (pitch and tempo together).
*Default value if none given:* 0.75
*Example:* `/speed 0.8`

- `/reverb`
Add reverberation to the audio using the ‘freeverb’ algorithm.
*Default values if none given:* reverberance (50%) HF-damping (50%) room-scale (100%) stereo-depth (100%) pre-delay (20ms) wet-gain (0dB)
*Example:* `/reverb 50 50 100 100 20 0`

- `/pitch`
Change the audio pitch (but not tempo).
*Default value if none given:* 500
*Example:* `/pitch 200`

- `/tempo`
Change the audio playback speed but not its pitch.
shift gives the pitch shift as positive or negative 'cents' (i.e. 100ths of a semitone)
*Default value if none given:* 0.8
*Example:* `/tempo 0.9`
'''

async def parse(reply_to_message, message_id, chat_id, speed=None, reverb=None, pitch=None, tempo=None):
  if 'audio' in reply_to_message:
    Thread(target=addEffect.delay, args=(reply_to_message['audio'], message_id, chat_id, speed, reverb, pitch, tempo)).start()
  if 'text' in reply_to_message:
    Thread(target=addEffect.delay, args=(reply_to_message['text'], message_id, chat_id, speed, reverb, pitch, tempo)).start()

  active_queues = celery_inspect.active()
  if len(active_queues[worker_name]) >= total_workers:
    await bot.sendMessage(chat_id, 'You\'re in queue, please wait...')

async def on_chat_message(msg):
  flavor = telepot.flavor(msg)
  summary = telepot.glance(msg, flavor=flavor)
  print(flavor, summary)

  if summary[0] == 'text':
    if 'reply_to_message' in msg:
      if '/slowedreverb' in msg['text']:
        speed = msg['text'].split(' ')
        if len(speed) > 1:
          speed = speed[1]
        else:
          speed = '0.75'
        await parse(msg['reply_to_message'], msg['reply_to_message']['message_id'], summary[2], speed=speed, reverb=['50', '50', '100', '100', '20', '0'])
      elif '/speed' in msg['text']:
        speed = msg['text'].split(' ')
        if len(speed) > 1:
          speed = speed[1]
        else:
          speed = '0.75'
        await parse(msg['reply_to_message'], msg['reply_to_message']['message_id'], summary[2], speed=speed)
      elif '/reverb' in msg['text']:
        reverb = msg['text'].split(' ')
        if len(reverb) == 1:
          reverb = ['50', '50', '100', '100', '20', '0']
        else:
          reverb.pop(0)
        await parse(msg['reply_to_message'], msg['reply_to_message']['message_id'], summary[2], reverb=reverb)
      elif '/pitch' in msg['text']:
          pitch = msg['text'].split(' ')
          if len(pitch) > 1:
            pitch = pitch[1]
          else:
            pitch = '500'
          await parse(msg['reply_to_message'], msg['reply_to_message']['message_id'], summary[2], pitch=pitch)
      elif '/tempo' in msg['text']:
          tempo = msg['text'].split(' ')
          if len(tempo) > 1:
            tempo = tempo[1]
          else:
            tempo = '0.8'
          await parse(msg['reply_to_message'], msg['reply_to_message']['message_id'], summary[2], tempo=tempo)
    elif '/start' in msg['text'] or '/help' in msg['text']:
      await bot.sendMessage(summary[2], helpMessage, parse_mode='Markdown')

TOKEN = open('token', 'r').read()  # get token from the token file

bot = telepot.aio.Bot(TOKEN)
answerer = telepot.aio.helper.Answerer(bot)

loop = asyncio.get_event_loop()
loop.create_task(MessageLoop(bot, {'chat': on_chat_message}).run_forever())

print ('Listening ...')

loop.run_forever()