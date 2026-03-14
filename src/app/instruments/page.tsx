export default function InstrumentsPage() {
  const instruments = [
    {
      brand: 'LEICA GEOSYSTEMS',
      models: ['TS06', 'TS09', 'TS15', 'TS16', 'TS60', 'Nova MS50', 'Nova MS60'],
      format: 'GSI-8 or GSI-16',
      export: 'Menu → Transfer → GSI',
      color: 'blue'
    },
    {
      brand: 'TRIMBLE',
      models: ['S3', 'S5', 'S7', 'S9', 'SX10', 'SX12'],
      format: 'JobXML',
      export: 'Transfer → PC → JobXML',
      color: 'red'
    },
    {
      brand: 'TOPCON',
      models: ['ES Series', 'GT Series', 'IS Series', 'GPT Series'],
      format: 'CSV (PT,N,E,Z,CD)',
      export: 'Memory Manager → Export',
      color: 'yellow'
    },
    {
      brand: 'SOKKIA',
      models: ['CX Series', 'IX Series', 'SX Series', 'FX Series'],
      format: 'SDR33',
      export: 'Data → Transfer → SDR33',
      color: 'green'
    },
    {
      brand: 'NIKON',
      models: ['DTM Series', 'NPL Series', 'Nivo Series'],
      format: 'RAW or CSV',
      export: 'Data Output → CSV',
      color: 'purple'
    },
    {
      brand: 'SOUTH SURVEYING',
      models: ['NTS-300', 'NTS-300R', 'NTS-500'],
      format: 'CSV',
      export: 'Data Manager → Export',
      color: 'orange'
    }
  ]

  const colorClasses: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-900/20 text-blue-400',
    red: 'border-red-500 bg-red-900/20 text-red-400',
    yellow: 'border-yellow-500 bg-yellow-900/20 text-yellow-400',
    green: 'border-green-500 bg-green-900/20 text-green-400',
    purple: 'border-purple-500 bg-purple-900/20 text-purple-400',
    orange: 'border-orange-500 bg-orange-900/20 text-orange-400',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-white mb-2">Compatible Instruments</h1>
        <p className="text-gray-400 text-lg mb-12">
          GeoNova imports data from all major total station brands
        </p>

        <div className="grid gap-6 mb-12">
          {instruments.map((inst) => (
            <div
              key={inst.brand}
              className="bg-[#111] rounded-xl border border-[#222] p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${colorClasses[inst.color]}`}>
                    {inst.brand}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Format</p>
                  <p className="text-amber-500 text-sm font-mono">{inst.format}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {inst.models.map(model => (
                  <span
                    key={model}
                    className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded"
                  >
                    {model}
                  </span>
                ))}
              </div>

              <div className="bg-gray-900/50 rounded p-3">
                <p className="text-gray-500 text-xs mb-1">How to export:</p>
                <p className="text-white text-sm font-mono">{inst.export}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#111] rounded-xl border border-[#222] p-6">
          <h2 className="text-xl font-bold text-white mb-4">How to Export from Your Instrument</h2>
          
          <div className="space-y-4">
            <ExportStep number="1" title="Prepare your data">
              Make sure your total station has stored all your survey points with coordinates computed.
            </ExportStep>
            <ExportStep number="2" title="Connect to computer">
              Use the USB cable or Bluetooth to connect your instrument to the computer.
            </ExportStep>
            <ExportStep number="3" title="Select export format">
              Choose the appropriate format for your instrument (GSI, JobXML, SDR, or CSV).
            </ExportStep>
            <ExportStep number="4" title="Transfer to computer">
              Use the instrument's data transfer software to save the file to your computer.
            </ExportStep>
            <ExportStep number="5" title="Import to GeoNova">
              Go to Import → Total Station and upload your file.
            </ExportStep>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-white font-medium">{title}</h3>
        <p className="text-gray-400 text-sm">{children}</p>
      </div>
    </div>
  )
}
