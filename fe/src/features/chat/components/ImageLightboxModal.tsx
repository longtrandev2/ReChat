import { useEffect } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ImageLightboxModalProps {
  isOpen: boolean
  imageUrl: string | null
  altText?: string
  onClose: () => void
}

export function ImageLightboxModal({
  isOpen,
  imageUrl,
  altText = 'Hình ảnh',
  onClose,
}: ImageLightboxModalProps) {
  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !imageUrl) return null

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      let downloadUrl = imageUrl
      if (downloadUrl.includes('/upload/') && !downloadUrl.includes('/fl_attachment')) {
        downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/')
      }
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = altText.includes('.') ? altText : 'image.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('Đang tải hình ảnh xuống...')
    } catch {
      let fallbackUrl = imageUrl
      if (fallbackUrl.includes('/upload/') && !fallbackUrl.includes('/fl_attachment')) {
        fallbackUrl = fallbackUrl.replace('/upload/', '/upload/fl_attachment/')
      }
      window.open(fallbackUrl, '_blank')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none"
      onClick={onClose}
      data-testid="image-lightbox-modal"
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/80 text-sm font-medium truncate max-w-md">
          {altText}
        </span>

        <div className="flex items-center gap-2">
          {/* Nút tải về */}
          <button
            type="button"
            title="Tải ảnh về máy"
            aria-label="Tải ảnh về máy"
            onClick={handleDownload}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Nút mở tab mới */}
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Mở ảnh gốc trong tab mới"
            aria-label="Mở ảnh gốc trong tab mới"
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <ExternalLink className="w-5 h-5" />
          </a>

          {/* Nút đóng */}
          <button
            type="button"
            title="Đóng (Esc)"
            aria-label="Đóng"
            onClick={onClose}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer ml-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <img
          src={imageUrl}
          alt={altText}
          onClick={(e) => e.stopPropagation()}
          className="max-w-[92vw] max-h-[85vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 transition-transform cursor-default"
        />
      </div>

      {/* Bottom Hint */}
      <div className="py-2.5 text-center text-xs text-white/40">
        Nhấn phím Esc hoặc bấm ra ngoài để đóng
      </div>
    </div>
  )
}
