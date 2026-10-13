import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

// Shared frame for /privacy and /terms: a readable single column with a way
// back to the app and to the other document.
export function LegalPage({
  title,
  other,
  children,
}: {
  title: string;
  other: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="legal-wrap">
      <div className="legal-top">
        <Link href="/" className="back-btn">
          ← Back to Ransom Tutor
        </Link>
        <ThemeToggle />
      </div>
      <article className="legal">
        <h1>{title}</h1>
        <p className="legal-date">Effective {LEGAL_EFFECTIVE_DATE}</p>
        {children}
        <p className="legal-other">
          See also: <Link href={other.href}>{other.label}</Link>
        </p>
      </article>
    </main>
  );
}
