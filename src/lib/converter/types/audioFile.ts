import path from 'node:path'

export enum FileType {
  RawMusic,
  Wav,
  M4a,
}

export class AudioFile {
  public path: string
  public type: FileType

  constructor(path: string, type: FileType) {
    this.path = path
    this.type = type
  }

  public get filename() {
    return path.basename(this.path, path.extname(this.path))
  }
}
