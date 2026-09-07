'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { lowlight } from '@/lib/lowlight'
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
  let parsedContent = content
  if (typeof content === 'string') {
    try {
      parsedContent = JSON.parse(content)
    } catch {}
  }

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: false,
          underline: false,
          heading: {
            levels: [1, 2, 3],
          },
        }),
        CodeBlockLowlight.configure({
          lowlight,
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
            class: 'text-zinc-100 underline underline-offset-4 hover:text-white font-medium',
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
      content: parsedContent || '',
      editorProps: {
        attributes: {
          class: 'tiptap-content text-zinc-200 focus:outline-none',
        },
      },
    },
    [content]
  )

  useEffect(() => {
    if (editor && parsedContent) {
      editor.commands.setContent(parsedContent)
    }
  }, [editor, content])

  if (!editor) return null

  return <EditorContent editor={editor} />
}
