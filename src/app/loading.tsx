export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="glass-panel mb-6 h-44 animate-pulse rounded-[32px]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="glass-panel h-[760px] animate-pulse rounded-[32px]" />
        <div className="space-y-6">
          <div className="glass-panel h-56 animate-pulse rounded-[32px]" />
          <div className="glass-panel h-32 animate-pulse rounded-[32px]" />
          <div className="glass-panel h-96 animate-pulse rounded-[32px]" />
        </div>
      </div>
    </div>
  );
}
