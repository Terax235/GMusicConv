import { exec } from 'node:child_process'
import { existsSync, promises as fspromises } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { write as writeMetadata } from 'ffmetadata'
import type { Metadata } from 'ffmetadata'
import { AudioFile, FileType } from './types/audioFile.js'

const execAsync = promisify(exec)
const writeMetadataAsync = promisify(writeMetadata)

const AcceptedFileTypes = Object.freeze([
  '.ast',
  '.brstm',
  '.bfstm',
  '.bcstm',
  '.bwav',
  '.nus3audio',
])

export default class Converter {
  public inputDir: string
  public outputDir: string
  public inputFiles?: AudioFile[]
  public baseMeta: Metadata
  public coverPath?: string

  constructor(inputDir: string, outputDir: string, meta?: Metadata, coverPath?: string) {
    this.inputDir = inputDir
    this.outputDir = outputDir
    this.baseMeta = meta ?? {}
    this.coverPath = coverPath
  }

  /**
   * Initialize the converter tool and generate the output directory
   */
  public async init(): Promise<void> {
    // Input dir
    this.inputFiles = await this.readAudioDir(this.inputDir)
    // Output dir
    if (!existsSync(this.outputDir)) {
      const outPath = path.join(this.outputDir, '1')
      await fspromises.mkdir(outPath, { recursive: true })
      this.outputDir = outPath
    }
    else {
      const entries = await fspromises.readdir(this.outputDir, { withFileTypes: true })
      const numberedDirs = entries
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => Number.parseInt(entry.name, 10))
      const nextNumber = numberedDirs.length > 0 ? Math.max(...numberedDirs) + 1 : 1
      const newDir = path.join(this.outputDir, nextNumber.toString())
      await fspromises.mkdir(newDir, { recursive: true })
      this.outputDir = newDir
    }
    // Cover path
    if (this.coverPath) {
      const ext = path.extname(this.coverPath)
      const outCoverPath = path.join(this.outputDir, `cover${ext}`)
      await fspromises.copyFile(this.coverPath, outCoverPath)
      this.coverPath = outCoverPath
    }
  }

  /**
   * Reads the given directory and returns audio files filtered by their file extensions (to only include video game music)
   * @param inputPath Directory to read audio files from
   * @returns Filtered audio file paths
   */
  public async readAudioDir(inputPath: string): Promise<AudioFile[]> {
    const files = await fspromises.readdir(inputPath)
    const filtered: AudioFile[] = []
    for (const file of files) {
      const fullPath = path.join(inputPath, file)
      const extension = path.extname(fullPath)
      if (AcceptedFileTypes.includes(extension)) {
        const audio = new AudioFile(fullPath, FileType.RawMusic)
        filtered.push(audio)
      }
    }
    return filtered
  }

  /**
   * Processes the given paths and converts the files
   * @returns Files generated in the output directory
   */
  public async run(): Promise<void[]> {
    if (!this.inputFiles) {
      return []
    }
    const conversionPromises = this.inputFiles.map(async (audio) => {
      const wav = await this.convertToWav(audio)
      if (wav !== null) {
        const m4a = await this.convertToM4a(wav)
        if (m4a !== null) {
          await fspromises.unlink(wav.path)
          const metadata: Metadata = { ...this.baseMeta, title: m4a.filename }
          await this.writeMetadata(m4a, metadata)
        }
      }
    })
    return Promise.all(conversionPromises)
  }

  /**
   * Uses vgmstream to convert an audio file to wav
   * @param audio Audio file
   * @returns Converted file
   */
  public async convertToWav(audio: AudioFile): Promise<AudioFile | null> {
    if (!this.outputDir)
      throw new Error('No valid output dir provided.')
    try {
      const outputFilePath = path.join(this.outputDir, `${audio.filename}.wav`)

      const command = `vgmstream-cli -l 1.0 -o "${outputFilePath}" "${audio.path}"`
      const { stderr } = await execAsync(command)

      if (stderr) {
        console.error(`[vgmstream] ${audio.filename}: Error ${stderr}`)
      }
      else {
        console.log(`[vgmstream] ${audio.filename}: Conversion successful`)
      }
      return new AudioFile(outputFilePath, FileType.Wav)
    }
    catch (error) {
      console.error(`[vgmstream] ${audio.filename}: Conversion failed: ${error}`)
      return null
    }
  }

  /**
   * Uses ffmpeg to convert a wav file to m4a using apple alac codec
   * @param wav Wav file to convert
   * @returns Converted file
   */
  public async convertToM4a(wav: AudioFile): Promise<AudioFile | null> {
    if (!this.outputDir)
      throw new Error('No valid output dir provided.')
    if (wav.type !== FileType.Wav)
      throw new Error('Invalid format supplied.')
    try {
      const outputFilePath = path.join(this.outputDir, `${wav.filename}.m4a`)
      const command = `ffmpeg -i "${wav.path}" -acodec alac "${outputFilePath}"`
      await execAsync(command)
      console.log(`[FFMPEG]  ${wav.filename}: Conversion successful`)
      return new AudioFile(outputFilePath, FileType.M4a)
    }
    catch (error) {
      console.error(`[FFMPEG] ${wav.filename} Conversion failed: ${error}`)
      return null
    }
  }

  /**
   * Writes audio metadata to the given m4a file
   * @param m4a M4a file to write metadata into
   * @param metadata Metadata to write into the file
   */
  public async writeMetadata(m4a: AudioFile, metadata: Metadata): Promise<void> {
    if (m4a.type !== FileType.M4a)
      throw new Error('Invalid format supplied.')
    try {
      const options = this.coverPath ? { disposition: true, attachments: [this.coverPath] } : {}
      await writeMetadataAsync(m4a.path, metadata, options)
      console.log(`[Metadata] ${m4a.filename}: Metadata written`)
    }
    catch (err) {
      console.error(`[Metadata] ${m4a.filename}: Metadata writing failed: ${err}`)
    }
  }
}
