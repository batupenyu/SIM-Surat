import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewModalProps {
  fileName: string;
  pdfData: Uint8Array;
  onDownload: () => void;
  onClose: () => void;
}

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  scale,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function renderPage() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({
        canvasContext: context,
        canvas,
        viewport,
      });

      await renderTask.promise;
    }

    renderPage().catch(() => {
      // Ignore cancellation errors on rapid zoom/unmount
    });

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="bg-white border border-slate-300 shadow-sm mx-auto">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

export function PdfPreviewModal({
  fileName,
  pdfData,
  onDownload,
  onClose,
}: PdfPreviewModalProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setErrorMsg(null);

    const loadingTask = pdfjsLib.getDocument({
      data: pdfData.slice(),
    });

    loadingTask.promise
      .then((doc) => {
        if (!active) {
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMsg(
          err instanceof Error
            ? `Gagal merender berkas PDF: ${err.message}`
            : 'Gagal merender berkas PDF.'
        );
        setLoading(false);
      });

    return () => {
      active = false;
      void loadingTask.destroy();
    };
  }, [pdfData]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Dokumen PDF"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="text-sm font-medium text-slate-900 truncate">
              {fileName}
            </span>
            {numPages > 0 && (
              <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                · {numPages} halaman
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
                aria-label="Perkecil tampilan"
                className="p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono tabular-nums text-slate-700">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.4, Number((s + 0.2).toFixed(1))))}
                aria-label="Perbesar tampilan"
                className="p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-200/70 p-6 space-y-5">
          {loading && (
            <div className="h-full flex items-center justify-center gap-2.5 text-sm text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
              <span>Memuat halaman dokumen PDF...</span>
            </div>
          )}

          {errorMsg && (
            <div className="max-w-md mx-auto bg-white border border-red-200 rounded-xl p-6 text-center space-y-3">
              <p className="text-sm text-red-700">{errorMsg}</p>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Berkas PDF
              </button>
            </div>
          )}

          {!loading &&
            !errorMsg &&
            pdfDoc &&
            Array.from({ length: numPages }, (_, idx) => (
              <PdfPageCanvas
                key={idx + 1}
                pdfDoc={pdfDoc}
                pageNumber={idx + 1}
                scale={scale}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
