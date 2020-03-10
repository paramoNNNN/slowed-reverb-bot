import os
import sys
import time
import shlex
import eyed3
import telepot
from librosa import load
from subprocess import PIPE, Popen
from telepot.loop import MessageLoop

def handle(msg):
    flavor = telepot.flavor(msg)

    summary = telepot.glance(msg, flavor=flavor)
    print(flavor, summary)
    if summary[0] == 'audio':
      artist = msg['audio']['performer'] if 'performer' in msg['audio'] else 'Unknown Artist'
      title = msg['audio']['title'] if 'title' in msg['audio'] else 'Untitled (slowed + reverb)'
      bot.sendMessage(summary[2], 'Downloading...')
      bot.download_file(msg['audio']['file_id'], 'temp/temp.mp3')

      cmd = shlex.split(
          ' '.join([
              'sox',
              '-N',
              '-V1',
              'temp/temp.mp3',
              '-C 320 -r 44100 -b 24 -c 2',
              'temp/temp2.mp3',
              'reverb 50 50 100 100 20 0',
              'speed 0.75',
          ]),
          posix=False)
      bot.sendMessage(summary[2], 'Adding effects...')
      stdout, stderr = Popen(cmd, stdout=PIPE, stderr=PIPE).communicate()
      if stderr:
          bot.sendMessage(summary[2], 'Something unexpected happend, Try again.')
          raise RuntimeError(stderr.decode())
      else:  
        audiofile = eyed3.load('temp/temp2.mp3')
        audiofile.initTag()
        audiofile.tag.artist = artist
        audiofile.tag.title = title + ' (slowed + reverb)'
        audiofile.tag.save()
        os.rename('temp/temp2.mp3',
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