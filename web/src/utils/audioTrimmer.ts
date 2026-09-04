// Web Audio API Audio Trimmer & WAV Encoder

/**
 * Decodes an audio File into an AudioBuffer and generates waveform peak bars
 */
export async function decodeAudioFile(file: File): Promise<{
  audioBuffer: AudioBuffer
  duration: number
  peaks: number[]
}> {
  const arrayBuffer = await file.arrayBuffer()
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new AudioContextClass()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  // Generate 60 normalized waveform peak bars
  const rawData = audioBuffer.getChannelData(0)
  const samples = 60
  const blockSize = Math.floor(rawData.length / samples)
  const peaks: number[] = []

  for (let i = 0; i < samples; i++) {
    let max = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j += 10) {
      const val = Math.abs(rawData[start + j] || 0)
      if (val > max) max = val
    }
    peaks.push(Math.max(0.15, Math.min(1.0, max * 1.6)))
  }

  return {
    audioBuffer,
    duration: audioBuffer.duration,
    peaks,
  }
}

/**
 * Slices an AudioBuffer from startSec to endSec and encodes to a valid .wav Blob
 */
export function sliceAndEncodeWav(
  audioBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  volumeMultiplier: number = 1.0
): Blob {
  const sampleRate = audioBuffer.sampleRate
  const channels = audioBuffer.numberOfChannels
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(audioBuffer.length, Math.floor(endSec * sampleRate))
  const length = Math.max(1, endSample - startSample)

  // Extract channels
  const channelData: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    const raw = audioBuffer.getChannelData(c)
    const sliced = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      sliced[i] = (raw[startSample + i] || 0) * volumeMultiplier
    }
    channelData.push(sliced)
  }

  // Create WAV bytes
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF identifier
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt subchunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // AudioFormat 1 = PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // Bits per sample

  // data subchunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write interleaved PCM 16-bit samples
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      let sample = channelData[c][i]
      sample = Math.max(-1, Math.min(1, sample))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
