'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { ResizableImageExtension } from './resizable-image'
import { Columns, Column } from './columns-extension'
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
  Video,
  Columns2,
  Undo,
  Redo,
  Loader2,
} from 'lucide-react'
import { useRef, useState } from 'react'

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
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
          class: 'text-zinc-100 underline underline-offset-4 hover:text-white font-medium',
        },
      }),
      Youtube.configure({
        inline: false,
        HTMLAttributes: {
          class: 'w-full rounded-2xl border border-zinc-800 my-4 aspect-video shadow-lg',
        },
      }),
      Columns,
      Column,
      ResizableImageExtension,
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

  // Insert local image preview immediately (uploaded only when saving/updating record)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const tempUrl = URL.createObjectURL(file)
    editor
      .chain()
      .focus()
      .setImage({
        src: tempUrl,
        alignment: 'center',
        width: '100%',
      } as any)
      .run()

    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const addYoutubeVideo = () => {
    const url = window.prompt('Enter YouTube Video URL')
    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
      })
    }
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
            editor.isActive('heading', { level: 1 }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
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
            editor.isActive('bold') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('italic') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('underline') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('strike') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('highlight') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Highlight text"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('code') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
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
            editor.isActive('bulletList') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('taskList') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Checklist / Task List"
        >
          <CheckSquare className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('blockquote') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('codeBlock') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
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

        {/* 2-Column Layout */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setColumns().run()}
          className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 transition-colors"
          title="Insert 2 Columns (Side by Side Image & Text)"
        >
          <Columns2 className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Text Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Link & Media */}
        <button
          type="button"
          onClick={setLink}
          className={`rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${
            editor.isActive('link') ? 'bg-zinc-800 text-zinc-100 font-bold' : ''
          }`}
          title="Insert Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={addYoutubeVideo}
          className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-zinc-400 hover:text-red-400"
          title="Embed YouTube Video"
        >
          <Video className="h-4 w-4" />
        </button>

        {/* Image Upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1 rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-zinc-400 hover:text-white"
          title="Insert Image (Click image inside editor to resize & align)"
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

      {/* Editor Content Body */}
      <EditorContent editor={editor} />
    </div>
  )
}
