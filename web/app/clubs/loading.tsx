export default function Loading() {
  return (
    <div className="py-6 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-56 bg-gray-100 rounded mb-6" />

      <div className="h-10 bg-gray-100 rounded-lg mb-4" />

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="h-5 w-2/3 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-1/3 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
