import Link from "next/link";

const LINKS = [["Privacy", "/privacy"], ["Terms", "/terms"], ["Data rights", "/data-request"], ["Delete my data", "/data-deletion"]];

export function LandingFooter() {
  return (
    <footer className="bg-lp-ground px-5 pb-8 pt-10 text-base text-lp-soft sm:px-8 md:pt-20 lg:px-14">
      <div className="mx-auto grid max-w-[1400px] gap-3 md:grid-cols-[1fr_auto_1fr] md:items-baseline">
        <p>ReplyKaro, WhatsApp automation for business.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
          {LINKS.map(([l, h]) => <Link key={h} href={h} className="py-1 font-medium text-lp-ink underline-offset-4 hover:underline">{l}</Link>)}
        </nav>
        <p className="md:text-right">© {new Date().getFullYear()} ReplyKaro. WhatsApp is a trademark of Meta Platforms.</p>
      </div>
    </footer>
  );
}
