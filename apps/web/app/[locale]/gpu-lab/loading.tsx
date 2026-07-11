export default function Loading() {
  return (
    <div className="container mx-auto max-w-6xl animate-pulse px-4 py-10">
      <div className="mb-2 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-muted" />
        <div className="h-8 w-48 rounded bg-muted" />
      </div>
      <div className="mb-8 h-4 w-2/3 max-w-lg rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 rounded-xl border border-border/40 bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
