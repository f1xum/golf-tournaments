export default function Loading() {
  return (
    <div className="py-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-64 bg-gray-100 rounded mb-6" />

      <div className="h-10 bg-gray-100 rounded-lg mb-4" />
      <div className="h-12 bg-gray-100 rounded-lg mb-4" />

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
