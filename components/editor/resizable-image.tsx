'use client'

import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import ImageExtension from '@tiptap/extension-image'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Maximize2,
} from 'lucide-react'
import { deleteStorageFile } from '@/lib/supabase/cleanup'

export function ResizableImageComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: any) {
  const { src, alt, alignment = 'center', width = '100%' } = node.attrs
  const [isSelected, setIsSelected] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [currentWidth, setCurrentWidth] = useState(width)
  const [dragDisplayWidth, setDragDisplayWidth] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Sync internal width with node attribute
  useEffect(() => {
    setCurrentWidth(width)
  }, [width])

  // Deselect when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Interactive drag resize handler from any handle (left or right)
  const startResizing = useCallback(
    (direction: 'left' | 'right' | 'corner-left' | 'corner-right', e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)

      const startX = e.clientX
      const imageEl = imageRef.current
      if (!imageEl) return

      const startWidthPx = imageEl.offsetWidth
      const parentEl = containerRef.current?.parentElement || document.body
      const parentWidthPx = parentEl.offsetWidth || 800

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        // If resizing from the left side, invert delta
        const multiplier = direction.includes('left') ? -2 : 2
        const rawNewWidth = startWidthPx + deltaX * (alignment === 'center' ? multiplier : 1)

        const clampedWidthPx = Math.max(120, Math.min(parentWidthPx, rawNewWidth))
        const percent = Math.round((clampedWidthPx / parentWidthPx) * 100)
        const formattedWidth = `${Math.min(100, Math.max(15, percent))}%`

        setCurrentWidth(formattedWidth)
        setDragDisplayWidth(`${Math.round(clampedWidthPx)}px (${formattedWidth})`)
      }

      const onMouseUp = (upEvent: MouseEvent) => {
        setIsDragging(false)
        setDragDisplayWidth(null)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        // Save final width to Tiptap node
        const finalDelta = upEvent.clientX - startX
        const multiplier = direction.includes('left') ? -2 : 2
        const rawNewWidth = startWidthPx + finalDelta * (alignment === 'center' ? multiplier : 1)
        const clampedWidthPx = Math.max(120, Math.min(parentWidthPx, rawNewWidth))
        const percent = Math.round((clampedWidthPx / parentWidthPx) * 100)
        const finalFormattedWidth = `${Math.min(100, Math.max(15, percent))}%`

        updateAttributes({ width: finalFormattedWidth })
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [alignment, updateAttributes]
  )

  const activeSelected = isSelected || selected || isDragging

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={`my-6 flex flex-col select-none ${
        alignment === 'left'
          ? 'items-start'
          : alignment === 'right'
          ? 'items-end'
          : 'items-center'
      }`}
    >
      <div
        className="relative inline-block"
        style={{ width: currentWidth || '100%', maxWidth: '100%' }}
        onClick={(e) => {
          e.stopPropagation()
          setIsSelected(true)
        }}
      >
        {/* Floating Alignment & Delete Toolbar on Selection */}
        {activeSelected && (
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Alignment Options */}
            <div className="flex items-center gap-0.5 border-r border-zinc-800 pr-1.5">
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'left' })}
                className={`rounded-lg p-1.5 transition-colors ${
                  alignment === 'left' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-zinc-400 hover:bg-zinc-800'
                }`}
                title="Align Left"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'center' })}
                className={`rounded-lg p-1.5 transition-colors ${
                  alignment === 'center' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-zinc-400 hover:bg-zinc-800'
                }`}
                title="Align Center"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'right' })}
                className={`rounded-lg p-1.5 transition-colors ${
                  alignment === 'right' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-zinc-400 hover:bg-zinc-800'
                }`}
                title="Align Right"
              >
                <AlignRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Full Width */}
            <button
              type="button"
              onClick={() => {
                setCurrentWidth('100%')
                updateAttributes({ width: '100%' })
              }}
              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                currentWidth === '100%' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Full Width"
            >
              100%
            </button>

            {/* Delete Image */}
            <button
              type="button"
              onClick={() => deleteNode()}
              className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 transition-colors ml-0.5"
              title="Delete Image"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Live Size Dimensions Indicator Badge while dragging */}
        {isDragging && dragDisplayWidth && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-zinc-950/90 border border-amber-500/50 px-3 py-1 text-[11px] font-mono font-semibold text-amber-400 shadow-xl backdrop-blur-md">
            {dragDisplayWidth}
          </div>
        )}

        {/* The Image Itself */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt || 'Record Image'}
          className={`w-full rounded-2xl border transition-all duration-75 block object-contain ${
            activeSelected
              ? 'border-amber-500 ring-4 ring-amber-500/20 shadow-2xl'
              : 'border-zinc-800 hover:border-zinc-700'
          }`}
          draggable={false}
        />

        {/* Interactive Drag Handles (Rendered when selected or hovering) */}
        {activeSelected && (
          <>
            {/* Top-Left Corner Handle */}
            <div
              onMouseDown={(e) => startResizing('corner-left', e)}
              className="absolute -top-2 -left-2 h-4 w-4 cursor-nwse-resize rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-md hover:scale-125 transition-transform"
            />

            {/* Top-Right Corner Handle */}
            <div
              onMouseDown={(e) => startResizing('corner-right', e)}
              className="absolute -top-2 -right-2 h-4 w-4 cursor-nesw-resize rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-md hover:scale-125 transition-transform"
            />

            {/* Bottom-Left Corner Handle */}
            <div
              onMouseDown={(e) => startResizing('corner-left', e)}
              className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-md hover:scale-125 transition-transform"
            />

            {/* Bottom-Right Corner Handle */}
            <div
              onMouseDown={(e) => startResizing('corner-right', e)}
              className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-md hover:scale-125 transition-transform flex items-center justify-center"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
            </div>

            {/* Left Edge Drag Bar */}
            <div
              onMouseDown={(e) => startResizing('left', e)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-2.5 cursor-ew-resize rounded-full bg-amber-400/90 ring-2 ring-zinc-950 shadow-md hover:scale-110 hover:bg-amber-400 transition-all"
            />

            {/* Right Edge Drag Bar */}
            <div
              onMouseDown={(e) => startResizing('right', e)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-10 w-2.5 cursor-ew-resize rounded-full bg-amber-400/90 ring-2 ring-zinc-950 shadow-md hover:scale-110 hover:bg-amber-400 transition-all"
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ResizableImageExtension = ImageExtension.extend({
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
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
})
