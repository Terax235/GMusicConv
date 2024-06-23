declare module 'ffmetadata' {
  interface Metadata {
    title?: string
    album?: string
    date?: string
    artist?: string
    genre?: string
    comment?: string
  }

  function write(
    file: string,
    data: Metadata,
    options: Record<string, unknown>,
    callback: (err: Error | null) => void
  ): void

  function setFfmpegPath(path: string): void
}
