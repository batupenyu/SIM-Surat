import { useState } from 'react';
import { ArrowRight, FileStack, GitBranch, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function LoginScreen() {
  const { signInWithGoogle, signingIn, authError } = useAuth();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-8">
        <span className="text-xl font-bold font-display tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          TataSurat
        </span>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={signingIn}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {signingIn ? 'Memproses...' : 'Masuk'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-blue-700 tracking-wide mb-3">
            Sistem Manajemen & Pelacakan Naskah Dinas
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-[42px] font-bold font-display text-slate-900 leading-[1.15] tracking-tight mb-5"
            style={{ textWrap: 'balance' }}
          >
            Lacak setiap surat masuk dan keluar secara real-time.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
            Catat registrasi surat, teruskan disposisi lintas unit kerja, dan
            pantau pergerakan dokumen secara sinkron dari satu meja kendali.
          </p>

          <div className="space-y-4 mb-8 border-t border-slate-200 pt-6">
            <div className="flex items-start gap-3">
              <FileStack className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Buku Agenda Digital Terpadu
                </p>
                <p className="text-sm text-slate-600">
                  Penomoran agenda dan kode pelacakan unik otomatis untuk surat masuk maupun keluar.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Disposisi & Riwayat Estafet Seketika
                </p>
                <p className="text-sm text-slate-600">
                  Setiap perpindahan unit dan catatan tindak lanjut tercatat kronologis secara langsung.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Siap Cetak Lembar Disposisi
                </p>
                <p className="text-sm text-slate-600">
                  Akses riwayat pelacakan lengkap beserta lembar disposisi resmi kapan saja.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{signingIn ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {authError && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {authError}
            </p>
          )}
        </div>

        <div className="lg:col-span-6 flex items-stretch">
          <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col">
            {!imgError ? (
              <img
                src="/src/assets/images/archive_correspondence_desk_1795503942585.jpg"
                alt="Meja arsip dan folder persuratan kantor yang tertata rapi"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-72 lg:h-full object-cover"
              />
            ) : (
              <div className="w-full h-72 lg:h-full bg-slate-100 flex flex-col items-center justify-center p-8 text-center">
                <FileStack className="w-10 h-10 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  Ruang Kendali Persuratan Digital
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <span>TataSurat · Sistem Pelacakan Persuratan Real-Time</span>
        <span>Sinkronisasi Firestore Terenkripsi</span>
      </footer>
    </div>
  );
}
