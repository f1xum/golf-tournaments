export default function Loading() {
  return (
    <div className="py-6 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gray-200 rounded-full" />
        <div>
          <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="h-16 flex-1 bg-gray-100 rounded-xl" />
        <div className="h-16 flex-1 bg-gray-100 rounded-xl" />
      </div>

      <div className="space-y-3">
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
      </div>

      <div className="h-6 w-48 bg-gray-200 rounded mt-8 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
