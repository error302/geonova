export default function JobsLoading() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="h-4 w-96 bg-gray-800 rounded"></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-800 rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

