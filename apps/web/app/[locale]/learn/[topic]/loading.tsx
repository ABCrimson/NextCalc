export default function Loading() {
  return (
    <div className="container mx-auto animate-pulse p-6">
      <div className="mb-4 h-8 w-1/3 rounded bg-muted" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
      </div>
    </div>
  );
}
