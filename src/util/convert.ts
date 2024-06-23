import { exec } from 'node:child_process'
import { existsSync, promises as fspromises } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import * as ffmetadata from 'ffmetadata'

const execAsync = promisify(exec)

export default class Converter {
  private outDir?: string

  public async init(outputDir: string): Promise<void> {
    if (!existsSync(outputDir)) {
      const outPath = path.join(outputDir, '1')
      await fspromises.mkdir(outPath, { recursive: true })
      this.outDir = outPath
    }
    else {
      const entries = await fspromises.readdir(outputDir, { withFileTypes: true })
      const numberedDirs = entries
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => Number.parseInt(entry.name, 10))
      const nextNumber = numberedDirs.length > 0 ? Math.max(...numberedDirs) + 1 : 1
      const newDir = path.join(outputDir, nextNumber.toString())
      await fspromises.mkdir(newDir, { recursive: true })
      this.outDir = newDir
    }
  }

  public async readAudioDir(inputPath: string): Promise<string[]> {
    const files = await fspromises.readdir(inputPath)
    const filtered: string[] = []
    for (const file of files) {
      const fullPath = path.join(inputPath, file)
      if (file.endsWith('.bwav') || file.endsWith('.brstm') || file.endsWith('.bcstm') || file.endsWith('.bfstm')) {
        filtered.push(fullPath)
      }
    }
    return filtered
  }

  public async processFiles(files: string[], meta: ffmetadata.Metadata): Promise<void> {
    for (const audio of files) {
      const wav = await this.convertToWav(audio)
      if (wav !== null) {
        const m4a = await this.convertToAlac(wav)
        if (m4a !== null) {
          await fspromises.unlink(wav)
          const title = path.basename(m4a, path.extname(m4a))
          const metadata: ffmetadata.Metadata = { ...meta, title }
          ffmetadata.write(m4a, metadata, {}, (err) => {
            if (err) {
              console.error(`[Metadata] ${title}: Error writing metadata ${err}`)
            }
            else {
              console.log(`[Metadata] ${title}: Metadata written successfully`)
            }
          })
        }
      }
    }
  }

  public async convertToWav(inputFilePath: string): Promise<string | null> {
    if (!this.outDir)
      throw new Error('No valid output dir provided.')
    try {
      const filename = path.basename(inputFilePath, path.extname(inputFilePath))
      const outputFilePath = path.join(this.outDir, `${filename}.wav`)

      const command = `vgmstream-cli -l 1.0 -o "${outputFilePath}" "${inputFilePath}"`
      const { stderr } = await execAsync(command)

      if (stderr) {
        console.error(`[vgmstream] ${filename}: Error ${stderr}`)
      }
      else {
        console.log(`[vgmstream] ${filename}: Conversion successful`)
      }
      return outputFilePath
    }
    catch (error) {
      console.error(`[vgmstream] Conversion failed: ${error}`)
      return null
    }
  }

  public async convertToAlac(inputWavPath: string): Promise<string | null> {
    if (!this.outDir)
      throw new Error('No valid output dir provided.')
    try {
      const filename = path.basename(inputWavPath, path.extname(inputWavPath))
      const outputFilePath = path.join(this.outDir, `${filename}.m4a`)

      const command = `ffmpeg -i "${inputWavPath}" -acodec alac "${outputFilePath}"`
      await execAsync(command)
      console.log(`[FFMPEG]  ${filename}: Conversion successful`)
      return outputFilePath
    }
    catch (error) {
      console.error(`[FFMPEG] Conversion failed: ${error}`)
      return null
    }
  }
}
