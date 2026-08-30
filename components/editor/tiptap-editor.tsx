'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  CodeXml,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRef, useState } from 'react'

// Custom Image Extension supporting width and alignment attributes
const CustomImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: 'center',
        renderHTML: (attributes) => ({
          class: `align-${attributes.alignment || 'center'}`,
        }),
      },
      width: {
        default: '100%',
        renderHTML: (attributes) => ({
          style: `width: ${attributes.width || '100%'};`,
        }),
      },
    }
  },
})

interface TiptapEditorProps {
  initialContent?: any
  onChange: (json: any) => void
  placeholder?: string
}

export function TiptapEditor({
  initialContent,
  onChange,
  placeholder = 'Write notes, capture takeaways, insert images, check off tasks...',
}: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImageWidth, setSelectedImageWidth] = useState<'33%' | '50%' | '75%' | '100%'>('100%')
  const [selectedImageAlignment, setSelectedImageAlignment] = useState<'left' | 'center' | 'right'>('center')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-amber-400 underline underline-offset-2 hover:text-amber-300',
        },
      }),
      CustomImage,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[350px] p-5 text-zinc-200',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
  })

  if (!editor) return null

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('record-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from('record-images').getPublicUrl(data.path)

      editor
        .chain()
        .focus()
        .setImage({
          src: publicUrl,
          alignment: selectedImageAlignment,
          width: selectedImageWidth,
        } as any)
        .run()
    } catch (err) {
      console.error('Image upload failed:', err)
      alert('Failed to upload image. Please ensure file is under 5MB.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter Link URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
      {/* Primary Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-900/80 p-2.5 text-zinc-400">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-zinc-800 text-amber-400 font-bold' : ''
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-zinc-800 text-amber-400 font-bold' : ''
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-zinc-800 text-amber-400 font-bold' : ''
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Inline Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('bold') ? 'bg-zinc-800 text-amber-400 font-bold' : ''
          }`}
          title="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('italic') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('underline') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('strike') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('highlight') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Highlight text"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('code') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Lists & Tasks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('taskList') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Checklist / Task List"
        >
          <CheckSquare className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('blockquote') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('codeBlock') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Code Block"
        >
          <CodeXml className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title="Horizontal Line"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Text Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={setLink}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('link') ? 'bg-zinc-800 text-amber-400' : ''
          }`}
          title="Insert Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        {/* Image Upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1 rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-amber-400"
          title="Insert & Position Image"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="flex-1" />

        {/* History */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>
      </div>

      {/* Secondary Image Control Bar (Placement & Size settings) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-900/40 px-3 py-1.5 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-500">Image Placement:</span>
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => setSelectedImageAlignment(align)}
              className={`rounded px-2 py-0.5 capitalize transition-colors ${
                selectedImageAlignment === align
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              {align}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-500">Size:</span>
          {(['33%', '50%', '75%', '100%'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedImageWidth(w)}
              className={`rounded px-2 py-0.5 transition-colors ${
                selectedImageWidth === w
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Content Body */}
      <EditorContent editor={editor} />
    </div>
  )
}
