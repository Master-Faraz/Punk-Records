'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { Columns, Column } from './columns-extension'

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
          style: `width: ${attributes.width || '100%'}; max-width: 100%;`,
        }),
      },
    }
  },
})

interface TiptapRendererProps {
  content: any
}

export function TiptapRenderer({ content }: TiptapRendererProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
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
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-amber-400 underline underline-offset-2 hover:text-amber-300',
          target: '_blank',
          rel: 'noopener noreferrer',
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
      CustomImage,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content text-zinc-200 focus:outline-none',
      },
    },
  })

  if (!editor) return null

  return <EditorContent editor={editor} />
}
