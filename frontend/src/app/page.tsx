export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Algorithmic ETF Trading</h1>
        <p className="text-lg mb-4">Welcome to your algorithmic trading platform</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
            <p className="text-sm text-gray-600">View portfolio and real-time data</p>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Strategies</h2>
            <p className="text-sm text-gray-600">Create and manage trading strategies</p>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Backtesting</h2>
            <p className="text-sm text-gray-600">Test strategies on historical data</p>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Paper Trading</h2>
            <p className="text-sm text-gray-600">Execute strategies with paper money</p>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Technical Analysis</h2>
            <p className="text-sm text-gray-600">Analyze charts and indicators</p>
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">ML Models</h2>
            <p className="text-sm text-gray-600">Train and deploy ML models</p>
          </div>
        </div>
      </div>
    </main>
  )
}
