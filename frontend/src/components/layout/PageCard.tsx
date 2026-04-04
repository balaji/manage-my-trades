export default function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900 md:m-3 md:min-h-[calc(100dvh-1.5rem)] md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:shadow-sm">
      <div className="p-5">{children}</div>
    </div>
  );
}
