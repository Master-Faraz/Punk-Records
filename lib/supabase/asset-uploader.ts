/**
 * Uploads a single Blob/File to /api/upload (which compresses to WebP with Sharp and stores in Supabase)
 */
export async function uploadBlobToStorage(blob: Blob | File): Promise<string> {
  const formData = new FormData()
  if (blob instanceof File) {
    formData.append('file', blob)
  } else {
    formData.append('file', blob, 'image.png')
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to upload image')
  }

  const { url } = await response.json()
  return url
}

/**
 * Prepares and uploads all pending local/blob assets (thumbnail & Tiptap images)
 * ONLY when the user clicks Create or Update.
 */
export async function processAndUploadPendingAssets({
  thumbnailFile,
  thumbnailUrl,
  content,
}: {
  thumbnailFile?: File | null
  thumbnailUrl?: string | null
  content: any
}): Promise<{
  finalThumbnailUrl: string | null
  finalContent: any
}> {
  // 1. Process thumbnail
  let finalThumbnailUrl = thumbnailUrl || null
  if (thumbnailFile) {
    finalThumbnailUrl = await uploadBlobToStorage(thumbnailFile)
  } else if (thumbnailUrl && thumbnailUrl.startsWith('blob:')) {
    const res = await fetch(thumbnailUrl)
    const blob = await res.blob()
    finalThumbnailUrl = await uploadBlobToStorage(blob)
  }

  // 2. Clone and process Tiptap content
  if (!content) {
    return {
      finalThumbnailUrl,
      finalContent: { type: 'doc', content: [{ type: 'paragraph' }] },
    }
  }

  const clonedContent = JSON.parse(JSON.stringify(content))

  async function processNode(node: any) {
    if (!node) return
    if (node.type === 'image' && node.attrs?.src && node.attrs.src.startsWith('blob:')) {
      try {
        const res = await fetch(node.attrs.src)
        const blob = await res.blob()
        const uploadedUrl = await uploadBlobToStorage(blob)
        node.attrs.src = uploadedUrl
      } catch (err) {
        console.error('Failed to upload tiptap blob image:', err)
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        await processNode(child)
      }
    }
  }

  await processNode(clonedContent)

  return {
    finalThumbnailUrl,
    finalContent: clonedContent,
  }
}
