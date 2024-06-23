import type * as ffmetadata from 'ffmetadata'
import Converter from './util/convert.js'
import { prompt, rl } from './util/readline.js'

const converter = new Converter()

const folderPath: string = await prompt('Please enter the folder Path: ') as string
const album = await prompt('Please enter the album name: ') as string
const artist = await prompt('Please enter the artist name: ') as string
const genre = await prompt('Please enter the genre: ') as string

converter.init('./out').then(async () => {
  const meta: ffmetadata.Metadata = {
    album,
    artist,
    genre,
  }
  const audio = await converter.readAudioDir(folderPath)
  await converter.processFiles(audio, meta).finally(() => rl.close())
})
