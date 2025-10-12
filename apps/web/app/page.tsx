import { Button } from "../components/ui/button";

export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Next.js + Tailwind</h1>
      <p className="mt-2 text-gray-600">Monorepo web app scaffold.</p>
      <div className="mt-4 flex gap-3">
        <Button>Button</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </main>
  );
}

