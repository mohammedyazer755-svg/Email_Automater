export default function Loading() {
  return (
    <div aria-label="Loading page" className="space-y-5">
      <div className="h-10 w-60 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}
