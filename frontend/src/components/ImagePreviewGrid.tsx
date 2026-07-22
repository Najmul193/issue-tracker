import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAttachmentPreview } from '../api/issues';
import type { Attachment } from '../api/issues';

interface ImagePreviewGridProps {
  attachments: Attachment[];
}

interface PreviewState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePreviewGrid({ attachments }: ImagePreviewGridProps) {
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const loadPreview = useCallback(async (att: Attachment) => {
    setPreviews((prev) => ({ ...prev, [att.id]: { url: null, loading: true, error: false } }));
    try {
      const url = await fetchAttachmentPreview(att.id);
      blobUrlsRef.current.set(att.id, url);
      setPreviews((prev) => ({ ...prev, [att.id]: { url, loading: false, error: false } }));
    } catch {
      setPreviews((prev) => ({ ...prev, [att.id]: { url: null, loading: false, error: true } }));
    }
  }, []);

  useEffect(() => {
    for (const att of attachments) {
      if (!previews[att.id] && !blobUrlsRef.current.has(att.id)) {
        loadPreview(att);
      }
    }
  }, [attachments, loadPreview, previews]);

  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current.clear();
    };
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) =>
          i !== null && i < attachments.length - 1 ? i + 1 : i,
        );
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, attachments.length, closeLightbox]);

  if (attachments.length === 0) return null;

  const gridCols =
    attachments.length === 1
      ? 'grid-cols-1'
      : attachments.length === 2
        ? 'grid-cols-2'
        : attachments.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-2';

  return (
    <>
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
        <div className={`grid ${gridCols} gap-2`}>
          {attachments.map((att, idx) => {
            const state = previews[att.id];
            return (
              <div
                key={att.id}
                className="group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white"
                onClick={() => setLightboxIndex(idx)}
              >
                {state?.loading && (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                  </div>
                )}
                {state?.error && (
                  <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                    <span className="text-xs text-gray-400">Preview unavailable</span>
                    <span className="mt-1 max-w-full truncate text-xs font-medium text-gray-600">
                      {att.fileName}
                    </span>
                  </div>
                )}
                {state?.url && (
                  <img
                    src={state.url}
                    alt={att.fileName}
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    draggable={false}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="max-w-full truncate text-xs text-white">{att.fileName}</p>
                  <p className="text-[10px] text-gray-200">{formatFileSize(att.fileSize)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lightboxIndex !== null && previews[attachments[lightboxIndex].id]?.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeLightbox}
        >
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i !== null ? i - 1 : i));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <img
            src={previews[attachments[lightboxIndex].id]!.url!}
            alt={attachments[lightboxIndex].fileName}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          {lightboxIndex < attachments.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i !== null ? i + 1 : i));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-sm">
            {lightboxIndex + 1} / {attachments.length}
          </div>
        </div>
      )}
    </>
  );
}
