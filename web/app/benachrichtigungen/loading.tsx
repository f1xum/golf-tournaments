export default function Loading() {
  return (
    <div className="py-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded mb-6" />

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
