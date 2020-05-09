import os
import sys
import shlex
import eyed3
import telepot
import youtube_dl
from celery import Celery
from datetime import datetime
from subprocess import PIPE, Popen

app = Celery('tasks', backend='redis://localhost:6379/0', broker='redis://localhost:6379/0')


TOKEN = open('token', 'r').read()
bot = telepot.Bot(TOKEN)

def send_message(chat_id, message_id, text):
  try:
    bot.sendMessage(chat_id, reply_to_message_id=message_id, text=text)
  except:
    bot.sendMessage(chat_id, text=text)

@app.task
def addEffect(audio_file, message_id, chat_id, speed=None, reverb=None, pitch=None, tempo=None):
  date_time = datetime.strftime(datetime.utcnow(), '%s')
  file_name = ''
  if isinstance(audio_file, dict):
    artist = audio_file['performer'] if 'performer' in audio_file else 'unknown artist'
    title = audio_file['title'] if 'title' in audio_file else 'untitled'
    send_message(chat_id, message_id, 'Downloading...')
    bot.download_file(audio_file['file_id'], f'temp/temp_{date_time}.mp3')
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
        send_message(chat_id, message_id, 'Downloading...')
        info = ydl.extract_info(audio_file, download=True)
        file_name = ydl.prepare_filename(info)
        file_name = file_name[:-5]
        meta = file_name.split('-')
        if len(meta) > 1:
          artist = meta[0][:-1]
          title = meta[1][1:]
        else:
          artist = 'unknown artist'
          title = meta[0]
        os.rename(f'{file_name}.mp3', f'temp/temp_{date_time}.mp3')
    else:
      file_name = audio_file
      meta = audio_file.split('-')
      if len(meta) > 1:
        artist = meta[0][:-1]
        title = meta[1][:-4][1:]
      else:
        artist = 'Unknown Artist'
        title = meta[0][:-4]
      os.rename(file_name, f'temp/temp_{date_time}.mp3')
  else:
    return

  commands = []
  if speed:
    commands.append('speed')
    commands.append(speed)
  if reverb:
    commands.append('reverb')
    commands.append(' '.join(reverb))
  if pitch:
    commands.append('pitch')
    commands.append(pitch)
  if tempo:
    commands.append('tempo')
    commands.append(tempo)
  cmd = shlex.split(
      ' '.join([
          'sox',
          '-N',
          '-V1',
          '--ignore-length',
          '-G',
          f'temp/temp_{date_time}.mp3',
          '-C 320 -r 44100 -b 24 -c 2',
          f'temp/temp_{date_time}.tmp.mp3',
      ] + list(map(str, commands))),
      posix=False)
  send_message(chat_id, message_id, 'Adding effects...')
  stdout, stderr = Popen(cmd, stdout=PIPE, stderr=PIPE).communicate()
  if stderr:
    send_message(chat_id, message_id, 'Something unexpected happend, Try again.')
    raise RuntimeError(stderr.decode())
  else:  
    audiofile = eyed3.load(f'temp/temp_{date_time}.tmp.mp3')
    audiofile.initTag()
    audiofile.tag.artist = artist
    if speed and reverb:
      audiofile.tag.artist = artist.lower()
      audiofile.tag.title = title.lower() + ' ﾉ slowed + reverb ﾉ'
    elif speed and not reverb and float(speed) < 1:
      audiofile.tag.artist = artist.lower()
      audiofile.tag.title = title.lower() + ' ﾉ slowed ﾉ'
    else:
      audiofile.tag.title = title
    audiofile.tag.save()
    os.rename(f'temp/temp_{date_time}.tmp.mp3',
              'outputs/%s - %s.mp3' % (audiofile.tag.artist, audiofile.tag.title))

    audio = open('outputs/%s - %s.mp3' % (audiofile.tag.artist, audiofile.tag.title), 'rb')
    bot.sendChatAction(chat_id, 'upload_audio')
    bot.sendAudio(chat_id, audio, performer=audiofile.tag.artist, title=audiofile.tag.title, duration=int(audiofile.info.time_secs))
