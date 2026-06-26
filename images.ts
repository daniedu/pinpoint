import { MAX_IMAGE_DIMENSION, THUMBNAIL_DIMENSION, JPEG_QUALITY } from './lib.ts'
import type { Pin, NoGpsImage } from './lib.ts'
import { gps } from 'https://esm.sh/exifr@7'

function generateId(): string {
  return crypto.randomUUID()
}

function optimizeImage(file: File, maxDim: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to encode blob'))
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export async function processImage(
  file: File,
  gps: { latitude: number; longitude: number } | null
): Promise<{ pin?: Pin; noGps?: NoGpsImage }> {
  const [optimizedBlob, thumbnailBlob] = await Promise.all([
    optimizeImage(file, MAX_IMAGE_DIMENSION),
    optimizeImage(file, THUMBNAIL_DIMENSION),
  ])

  const id = generateId()

  if (gps) {
    return {
      pin: {
        id,
        lat: gps.latitude,
        lng: gps.longitude,
        optimizedBlob,
        thumbnailBlob,
        fileName: file.name,
      },
    }
  }

  return {
    noGps: {
      id,
      fileName: file.name,
      optimizedBlob,
    },
  }
}

export async function extractGps(
  file: File
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const result = await gps(file)
    if (
      result &&
      typeof result.latitude === 'number' &&
      typeof result.longitude === 'number'
    ) {
      return { latitude: result.latitude, longitude: result.longitude }
    }
  } catch {}
  return null
}
