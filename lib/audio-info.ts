export interface AudioMetadata {
  sampleRate: number;
  bitDepth: number | string;
  channels: number;
  format: string;
}

export async function getAudioMetadata(file: File): Promise<AudioMetadata | null> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const isWav  = ext === 'wav';
  const isFlac = ext === 'flac';
  const isAiff = ext === 'aiff' || ext === 'aif';

  // WAV: read true header
  if (isWav) {
    try {
      const buf  = await file.slice(0, 44).arrayBuffer();
      const view = new DataView(buf);
      const riff = view.getUint32(0, false);
      const wave = view.getUint32(8, false);
      if (riff === 0x52494646 && wave === 0x57415645) {
        const channels   = view.getUint16(22, true);
        const sampleRate = view.getUint32(24, true);
        const bitDepth   = view.getUint16(34, true);
        return { sampleRate, bitDepth, channels, format: 'WAV' };
      }
    } catch (_) {}
  }

  // FLAC: scan STREAMINFO block
  if (isFlac) {
    try {
      const buf  = await file.slice(0, 42).arrayBuffer();
      const view = new DataView(buf);
      if (view.getUint32(0, false) === 0x664C6143) {
        const srHigh = view.getUint8(18);
        const srMid  = view.getUint8(19);
        const srLow  = view.getUint8(20);
        const sampleRate = ((srHigh << 12) | (srMid << 4) | (srLow >> 4)) & 0xFFFFF;
        const channels   = (((srLow >> 1) & 0x07) + 1);
        const bpsHigh    = (srLow & 0x01) << 4;
        const bpsLow     = (view.getUint8(21) >> 4) & 0x0F;
        const bitDepth   = (bpsHigh | bpsLow) + 1;
        if (sampleRate > 0) {
          return { sampleRate, bitDepth, channels, format: 'FLAC' };
        }
      }
    } catch (_) {}
  }

  // AIFF: read COMM chunk
  if (isAiff) {
    try {
      const buf  = await file.slice(0, 54).arrayBuffer();
      const view = new DataView(buf);
      if (view.getUint32(0, false) === 0x464F524D) {
        const chunkId = view.getUint32(12, false);
        if (chunkId === 0x434F4D4D) {
          const channels  = view.getInt16(20, false);
          const bitDepth  = view.getInt16(26, false);
          const exp       = view.getInt16(28, false) - 16383 - 63;
          const mant      = view.getUint32(30, false);
          const sampleRate = Math.round(mant * Math.pow(2, exp));
          if (sampleRate > 0) {
            return { sampleRate, bitDepth, channels, format: 'AIFF' };
          }
        }
      }
    } catch (_) {}
  }

  // MP3 / AAC / OGG / M4A — decode a small slice to get the true sample rate
  try {
    const sliceSize = Math.min(file.size, 131072); // 128 KB is enough for headers
    const arrayBuf  = await file.slice(0, sliceSize).arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    try {
      const decoded    = await ctx.decodeAudioData(arrayBuf.slice(0));
      const sampleRate = decoded.sampleRate;
      const channels   = decoded.numberOfChannels;
      ctx.close();

      const fmt = ext.toUpperCase() || file.type.split('/')[1]?.toUpperCase() || 'AUDIO';
      let bitDepth: number | string = 16;
      if (fmt === 'FLAC') bitDepth = 24;

      return { sampleRate, bitDepth, channels, format: fmt };
    } catch (decodeErr) {
      ctx.close();
      throw decodeErr;
    }
  } catch (_) {}

  return {
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    format: ext.toUpperCase() || file.type.split('/')[1]?.toUpperCase() || 'AUDIO',
  };
}
