import readline from 'node:readline'
import process from 'node:process'

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

export async function prompt(query: string) {
  return new Promise(resolve => rl.question(query, resolve))
}
