export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-amber-500 text-4xl font-bold mb-4">GEONOVA</h1>
        <p className="text-white text-xl mb-2">You are offline</p>
        <p className="text-gray-400">Your saved projects and calculations are still available.</p>
        <p className="text-gray-400 mt-2">Connect to sync your data.</p>
      </div>
    </div>
  )
}
