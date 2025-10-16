export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">NextCalc Pro</h1>
          <p className="text-muted-foreground">
            Modern scientific calculator powered by React 19 + Next.js 15
          </p>
        </header>

        <div className="max-w-2xl mx-auto">
          <div className="p-8 border rounded-lg bg-card">
            <p className="text-center text-muted-foreground">
              Calculator component will be added here
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
