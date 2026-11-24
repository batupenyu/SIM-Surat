import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  Forward,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type {
  LetterDirection,
  LetterPriority,
  LetterStatus,
} from '../types/correspondence';

export function DirectionLabel({ direction }: { direction: LetterDirection }) {
  if (direction === 'masuk') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
        <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
        Surat Masuk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
      Surat Keluar
    </span>
  );
}

export function StatusLabel({ status }: { status: LetterStatus }) {
  switch (status) {
    case 'Terdaftar':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Terdaftar
        </span>
      );
    case 'Diproses':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Diproses
        </span>
      );
    case 'Didisposisikan':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Forward className="w-3.5 h-3.5 shrink-0" />
          Didisposisikan
        </span>
      );
    case 'Terkirim':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <Send className="w-3.5 h-3.5 shrink-0" />
          Terkirim
        </span>
      );
    case 'Diterima':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
          Diterima
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Selesai
        </span>
      );
    case 'Diarsipkan':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <Archive className="w-3.5 h-3.5 shrink-0" />
          Diarsipkan
        </span>
      );
  }
}

export function PriorityLabel({ priority }: { priority: LetterPriority }) {
  switch (priority) {
    case 'Segera':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          Segera
        </span>
      );
    case 'Rahasia':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          Rahasia
        </span>
      );
    case 'Penting':
      return (
        <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
          Penting
        </span>
      );
    case 'Biasa':
      return (
        <span className="text-xs text-slate-500 whitespace-nowrap">Biasa</span>
      );
  }
}
