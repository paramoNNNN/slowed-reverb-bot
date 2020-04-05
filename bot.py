import os
import sys
import time
import shlex
import eyed3
import telepot
import youtube_dl
from librosa import load
from subprocess import PIPE, Popen
from telepot.loop import MessageLoop

def addEffect(audio_file, chat_id, speed=None, pitch=None, tempo=None):
  if isinstance(audio_file, dict):
    artist = audio_file['performer'] if 'performer' in audio_file else 'Unknown Artist'
    title = audio_file['title'] if 'title' in audio_file else 'Untitled (slowed + reverb)'
    bot.sendMessage(chat_id, 'Downloading...')
    bot.download_file(audio_file['file_id'], 'temp/temp.mp3')
  elif isinstance(audio_file, str):
    if audio_file.startswith('https://www.youtube.com/watch?v=') or\
        audio_file.startswith('https://youtube.com/watch?v=') or\
          audio_file.startswith('https://youtu.be/'):
      ydl_opts = {
        'outtmpl': '%(title)s.%(ext)s',
        'format': 'bestaudio/best',
        'postprocessors': [
          {
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '320',
          },
          {
            'key': 'MetadataFromTitle',
            'titleformat': '(?P<artist>.*)-(?P<track>.*)',
          }
        ],
        '_titleformat': '(?P<artist>.*)-(?P<track>.*)'
      }

      with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        bot.sendMessage(chat_id, 'Downloading...')
        info = ydl.extract_info(audio_file, download=True)
        file_name = ydl.prepare_filename(info)
        file_name = file_name.split('.')[0]
        meta = file_name.split('-')
        if len(meta) > 1:
          artist = meta[0][:-1]
          title = meta[1][:-4][1:]
        else:
          artist = 'Unknown Artist'
          title = meta[0][:-4]
        os.rename(file_name + '.mp3', 'temp/temp.mp3')
    else:
      meta = audio_file.split('-')
      if len(meta) > 1:
        artist = meta[0][:-1]
        title = meta[1][:-4][1:]
      else:
        artist = 'Unknown Artist'
        title = meta[0][:-4]
      os.rename(audio_file, 'temp/temp.mp3')
  else:
    return

  commands = []
  if speed:
    commands.append('speed')
    commands.append(speed)
  elif pitch:
    commands.append('pitch')
    commands.append(pitch)
  elif tempo:
    commands.append('tempo')
    commands.append(tempo)
  cmd = shlex.split(
      ' '.join([
          'sox',
          '-N',
          '-V1',
          '--ignore-length',
          'temp/temp.mp3',
          '-C 320 -r 44100 -b 24 -c 2',
          'temp/temp2.mp3',
          'reverb 50 50 100 100 20 0',
      ] + list(map(str, commands))),
      posix=False)

  bot.sendMessage(chat_id, 'Adding effects...')
  stdout, stderr = Popen(cmd, stdout=PIPE, stderr=PIPE).communicate()
  if stderr:
      bot.sendMessage(chat_id, 'Something unexpected happend, Try again.')
      raise RuntimeError(stderr.decode())
  else:  
    audiofile = eyed3.load('temp/temp2.mp3')
    audiofile.initTag()
    audiofile.tag.artist = artist
    if speed:
      audiofile.tag.title = title + ' (slowed + reverb)'
    else:
      audiofile.tag.title = title
    audiofile.tag.save()
    os.rename('temp/temp2.mp3',
              'outputs/%s - %s (slowed + reverb).mp3' % (artist, title))

    audio = open('outputs/%s - %s (slowed + reverb).mp3' % (artist, title), 'rb')
    bot.sendChatAction(chat_id, 'upload_audio')
    bot.sendAudio(chat_id, audio, performer=artist, title=title + ' (slowed + reverb)', duration=int(audiofile.info.time_secs))

def handle(msg):
    flavor = telepot.flavor(msg)
    summary = telepot.glance(msg, flavor=flavor)
    print(flavor, summary)

    if summary[0] == 'text':
      if '/slowedreverb' in msg['text']:
        if 'reply_to_message' in msg:
          speed = msg['text'].split(' ')
          if len(speed) > 1:
            speed = speed[1]
          else:
            speed = '0.75'
          if 'audio' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['audio'], summary[2], speed=speed)
          if 'text' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['text'], summary[2], speed=speed)
      elif '/pitch' in msg['text']:
          pitch = msg['text'].split(' ')
          if len(pitch) > 1:
            pitch = pitch[1]
          else:
            pitch = '500'
          if 'audio' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['audio'], summary[2], pitch=pitch)
          if 'text' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['text'], summary[2], pitch=pitch)   
      elif '/tempo' in msg['text']:
          tempo = msg['text'].split(' ')
          if len(tempo) > 1:
            tempo = tempo[1]
          else:
            tempo = '0.8'
          if 'audio' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['audio'], summary[2], tempo=tempo)
          if 'text' in msg['reply_to_message']:
            addEffect(msg['reply_to_message']['text'], summary[2], tempo=tempo)   


TOKEN = sys.argv[1]  # get token from command-line

bot = telepot.Bot(TOKEN)
MessageLoop(bot, handle).run_as_thread()
print ('Listening ...')

while 1:
    time.sleep(10)
