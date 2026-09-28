import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl" aria-hidden>🧭</p>
      <h1 className="mt-4 text-3xl font-black">We can&apos;t find that page</h1>
      <p className="mt-2 text-lg text-ink-soft">Let&apos;s get you back on track.</p>
      <Link href="/" className="mt-6 inline-flex min-h-14 items-center rounded-2xl bg-sea-600 px-6 text-lg font-bold text-white">
        Go Home
      </Link>
    </main>
  );
}
