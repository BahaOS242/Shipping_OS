import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-6xl" aria-hidden>🔎</p>
      <h1 className="mt-4 text-3xl font-black">We can&apos;t find that package</h1>
      <p className="mt-2 text-lg text-ink-soft">It may belong to another account. Let&apos;s look at yours.</p>
      <ButtonLink href="/packages" className="mt-6" icon="📦">See My Packages</ButtonLink>
    </div>
  );
}
