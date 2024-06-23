import path from 'node:path'
import process from 'node:process'
import fs from 'node:fs'
import Converter from './lib/converter/Converter.js'
import { prompt, rl } from './util/readline.js'

const outDir = path.join(process.cwd(), 'out')

const folderPath: string = await prompt('Please enter the folder Path: ') as string
const album = await prompt('Please enter the album name: ') as string
const artist = await prompt('Please enter the artist name: ') as string
const genre = await prompt('Please enter the genre: ') as string
const year = await prompt('Please enter the year: ') as string
const cover = await prompt('Please enter a cover image (if wanted): ') as string

const converter = new Converter(folderPath, outDir, { album, artist, genre, date: year }, cover)

converter.init().then(async () => {
  console.log(`[Converter] ${converter.inputFiles?.length} files | Output path: ${converter.outputDir}`)

  const audio = await converter.readAudioDir(folderPath)
  const start = Date.now()
  await converter.run().finally(() => rl.close())
  console.log(`[Info] Conversion for ${audio.length} files took ${Date.now() - start}ms`)
  // Write metadata.json
  const metadataPath = path.join(converter.outputDir, 'metadata.json')
  await fs.promises.writeFile(metadataPath, JSON.stringify(converter.baseMeta, null, 2))
})
