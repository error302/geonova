export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GeoNova API Documentation</h1>
        <p className="text-gray-600 mb-8">Integrate GeoNova into your applications</p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">API Access</h2>
          <p className="text-blue-800 text-sm mb-4">
            API access is available on Professional and Enterprise plans. Get your API key from your account settings.
          </p>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Base URL</p>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">https://api.geonova.app/v1</code>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication</h2>
            <p className="text-gray-600 mb-4">
              All API requests require an API key passed in the header:
            </p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm">
{`curl -H "Authorization: Bearer gnv_xxxxxxxxxxxx" \\
     https://api.geonova.app/v1/coordinates/transform`}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Coordinate Transformation</h2>
            <p className="text-gray-600 mb-4">Transform coordinates between WGS84 and UTM</p>
            
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-4">
              <pre className="text-green-400 text-sm">
{`POST /v1/coordinates/transform
Content-Type: application/json

{
  "latitude": -1.286389,
  "longitude": 36.817222,
  "from": "wgs84",
  "to": "utm"
}`}
              </pre>
            </div>

            <h3 className="font-medium text-gray-800 mb-2">Response</h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-blue-400 text-sm">
{`{
  "success": true,
  "easting": 258331.4567,
  "northing": 9857744.1234,
  "zone": 37,
  "hemisphere": "S"
}`}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Benchmark Lookup</h2>
            <p className="text-gray-600 mb-4">Search for benchmark data by name or location</p>
            
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-4">
              <pre className="text-green-400 text-sm">
{`GET /v1/benchmarks/search?query=Nairobi&country=kenya`}
              </pre>
            </div>

            <h3 className="font-medium text-gray-800 mb-2">Response</h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-blue-400 text-sm">
{`{
  "success": true,
  "results": [
    {
      "name": "Nairobi BM1",
      "elevation": 1791.234,
      "order": "Primary",
      "latitude": -1.2921,
      "longitude": 36.8219
    }
  ]
}`}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Weather/EDM Correction</h2>
            <p className="text-gray-600 mb-4">Get atmospheric correction parameters for EDM</p>
            
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-4">
              <pre className="text-green-400 text-sm">
{`POST /v1/weather/edm-correction
Content-Type: application/json

{
  "temperature": 25,
  "pressure": 1013.25,
  "humidity": 60,
  "distance": 500
}`}
              </pre>
            </div>

            <h3 className="font-medium text-gray-800 mb-2">Response</h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-blue-400 text-sm">
{`{
  "success": true,
  "ppm": 12.5,
  "correctedDistance": 500.006,
  "correction": 0.006
}`}
              </pre>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rate Limits</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Plan</th>
                  <th className="text-left py-2">Requests/minute</th>
                  <th className="text-left py-2">Daily limit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Starter</td>
                  <td className="py-2">60</td>
                  <td className="py-2">1,000</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Professional</td>
                  <td className="py-2">300</td>
                  <td className="py-2">50,000</td>
                </tr>
                <tr>
                  <td className="py-2">Enterprise</td>
                  <td className="py-2">Unlimited</td>
                  <td className="py-2">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Handling</h2>
            <p className="text-gray-600 mb-4">All errors return standard HTTP status codes</p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-blue-400 text-sm">
{`{
  "success": false,
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "Latitude must be between -90 and 90"
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
