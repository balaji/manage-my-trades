import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Algorithmic ETF Trading</h1>
        <p className="text-lg mb-4">Welcome to your algorithmic trading platform</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-6 border rounded-lg opacity-60 cursor-not-allowed">
            <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
            <p className="text-sm text-gray-600">View portfolio and real-time data</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>

          <Link
            href="/strategies"
            className="p-6 border rounded-lg hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Strategies</h2>
            <p className="text-sm text-gray-600">Create and manage trading strategies</p>
          </Link>

          <Link
            href="/backtests"
            className="p-6 border rounded-lg hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Backtesting</h2>
            <p className="text-sm text-gray-600">Test strategies on historical data</p>
          </Link>

          <div className="p-6 border rounded-lg opacity-60 cursor-not-allowed">
            <h2 className="text-xl font-semibold mb-2">Paper Trading</h2>
            <p className="text-sm text-gray-600">Execute strategies with paper money</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>

          <a
            href="/technical-analysis"
            className="p-6 border rounded-lg hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Technical Analysis</h2>
            <p className="text-sm text-gray-600">Analyze charts and indicators</p>
          </a>

          <div className="p-6 border rounded-lg opacity-60 cursor-not-allowed">
            <h2 className="text-xl font-semibold mb-2">ML Models</h2>
            <p className="text-sm text-gray-600">Train and deploy ML models</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>
        </div>
      </div>
    </main>
  );
}
