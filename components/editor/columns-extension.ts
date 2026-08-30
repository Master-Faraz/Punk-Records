import { Node, mergeAttributes } from '@tiptap/core'

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'flex flex-col gap-2 min-w-0 p-3 rounded-xl border border-zinc-800/60 bg-zinc-900/20 focus-within:border-zinc-700 transition-colors',
      }),
      0,
    ]
  },
})

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'columns',
        class: 'grid grid-cols-1 md:grid-cols-2 gap-4 my-5 p-1 rounded-2xl border border-dashed border-zinc-800/80',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setColumns:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left Column: Type text or insert notes here...' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right Column: Insert image or key takeaways...' }] }],
              },
            ],
          })
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: () => ReturnType
    }
  }
}
