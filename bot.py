import os
import sys
import time
import eyed3
import asyncio
import telepot
from librosa import load
from pysndfx import AudioEffectsChain
from telepot.loop import MessageLoop

def handle(msg):
    flavor = telepot.flavor(msg)

    summary = telepot.glance(msg, flavor=flavor)
    print(flavor, summary)
    if summary[0] == 'audio':
      artist = msg['audio']['performer'] if 'performer' in msg['audio'] else 'Unknown Artist'
      title = msg['audio']['title'] if 'title' in msg['audio'] else 'Untitled (slowed + reverb)'
      bot.download_file(msg['audio']['file_id'], 'temp/temp.mp3')

      fx = (AudioEffectsChain().reverb().speed(0.35))
      y, sr = load('temp/temp.mp3')
      fx(y, 'temp/temp.mp3')
      
      audiofile = eyed3.load('temp/temp.mp3')
      audiofile.initTag()
      audiofile.tag.artist = artist
      audiofile.tag.title = title + ' (slowed + reverb)'
      audiofile.tag.save()
      os.rename('temp/temp.mp3',
                'outputs/%s - %s (slowed + reverb).mp3' % (artist, title))

      audio = open('outputs/%s - %s (slowed + reverb).mp3' % (artist, title), 'rb')
      bot.sendChatAction(summary[2], 'upload_audio')
      bot.sendAudio(summary[2], audio)


TOKEN = sys.argv[1]  # get token from command-line

bot = telepot.Bot(TOKEN)
MessageLoop(bot, handle).run_as_thread()
print ('Listening ...')

while 1:
    time.sleep(10)