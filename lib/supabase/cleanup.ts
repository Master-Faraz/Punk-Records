import { createClient } from './client'
import type { RecordItem } from '@/types/database'

/**
 * Recursively extracts all image URLs from a Tiptap JSON document
 */
export function extractImageUrls(content: any): string[] {
  const urls: string[] = []
  if (!content) return urls

  function traverse(node: any) {
    if (!node) return
    if (node.type === 'image' && node.attrs?.src) {
      urls.push(node.attrs.src)
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  traverse(content)
  return urls
}

/**
 * Extracts storage relative file paths from Supabase public URLs
 */
export function extractStoragePath(publicUrl: string, bucketName = 'record-images'): string | null {
  if (!publicUrl) return null
  const marker = `/storage/v1/object/public/${bucketName}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.substring(index + marker.length))
}

/**
 * Deletes a single image file from Supabase Storage given its public URL
 */
export async function deleteStorageFile(publicUrl: string, bucketName = 'record-images') {
  if (!publicUrl) return
  const path = extractStoragePath(publicUrl, bucketName)
  if (!path) return

  const supabase = createClient()
  try {
    await supabase.storage.from(bucketName).remove([path])
  } catch (err) {
    console.warn('Failed to delete storage file:', err)
  }
}

/**
 * Compares the old record with the updated record, and deletes any images from Supabase Storage
 * that were removed from the thumbnail or the Tiptap editor content.
 */
export async function cleanupRemovedAssets(
  oldRecord: { thumbnail_url?: string | null; content?: any },
  newRecord: { thumbnail_url?: string | null; content?: any }
) {
  const supabase = createClient()
  const oldUrls = new Set<string>()
  const newUrls = new Set<string>()

  if (oldRecord.thumbnail_url) oldUrls.add(oldRecord.thumbnail_url)
  extractImageUrls(oldRecord.content).forEach((url) => oldUrls.add(url))

  if (newRecord.thumbnail_url) newUrls.add(newRecord.thumbnail_url)
  extractImageUrls(newRecord.content).forEach((url) => newUrls.add(url))

  const pathsToDelete: string[] = []
  for (const oldUrl of oldUrls) {
    if (!newUrls.has(oldUrl)) {
      const storagePath = extractStoragePath(oldUrl)
      if (storagePath) pathsToDelete.push(storagePath)
    }
  }

  if (pathsToDelete.length > 0) {
    try {
      await supabase.storage.from('record-images').remove(pathsToDelete)
    } catch (err) {
      console.warn('Failed to delete removed storage assets:', err)
    }
  }
}

/**
 * Deletes a record from the database AND deletes all associated images from Supabase Storage
 */
export async function deleteRecordWithAssets(record: Pick<RecordItem, 'id' | 'thumbnail_url' | 'content'>) {
  const supabase = createClient()

  const pathsToDelete: string[] = []

  // 1. Check thumbnail
  if (record.thumbnail_url) {
    const thumbPath = extractStoragePath(record.thumbnail_url)
    if (thumbPath) pathsToDelete.push(thumbPath)
  }

  // 2. Check all images inside Tiptap content
  const contentUrls = extractImageUrls(record.content)
  for (const url of contentUrls) {
    const filePath = extractStoragePath(url)
    if (filePath) pathsToDelete.push(filePath)
  }

  // 3. Remove storage objects in batch if any exist
  if (pathsToDelete.length > 0) {
    try {
      await supabase.storage.from('record-images').remove(pathsToDelete)
    } catch (err) {
      console.warn('Storage cleanup warning:', err)
    }
  }

  // 4. Delete record from database (cascade deletes record_tags & reviews)
  const { error } = await supabase.from('records').delete().eq('id', record.id)
  if (error) throw error
}
