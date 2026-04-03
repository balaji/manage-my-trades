import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Algorithmic ETF Trading</h1>
        <p className="text-lg mb-4">Welcome to your algorithmic trading platform</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>View portfolio and real-time data</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>

          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle>Paper Trading</CardTitle>
              <CardDescription>Execute strategies with paper money</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>

          <Link href="/backtests">
            <Card className="hover:ring-primary/50 hover:shadow-lg transition-all cursor-pointer">
              <CardHeader>
                <CardTitle>Backtesting</CardTitle>
                <CardDescription>Test strategies on historical data</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/strategies">
            <Card className="hover:ring-primary/50 hover:shadow-lg transition-all cursor-pointer">
              <CardHeader>
                <CardTitle>Strategies</CardTitle>
                <CardDescription>Create and manage trading strategies</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/technical-analysis">
            <Card className="hover:ring-primary/50 hover:shadow-lg transition-all cursor-pointer">
              <CardHeader>
                <CardTitle>Technical Analysis</CardTitle>
                <CardDescription>Analyze charts and indicators</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle>ML Models</CardTitle>
              <CardDescription>Train and deploy ML models</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
