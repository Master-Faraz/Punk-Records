import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file bytes into Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Convert & compress with Sharp to WebP (quality 80%, max width 1600px)
    const optimizedBuffer = await sharp(buffer)
      .resize({
        width: 1600,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer()

    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`

    // Upload optimized WebP to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('record-images')
      .upload(fileName, optimizedBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('record-images').getPublicUrl(uploadData.path)

    return NextResponse.json({
      url: publicUrl,
      path: uploadData.path,
    })
  } catch (error: any) {
    console.error('Image processing error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to process image' }, { status: 500 })
  }
}
