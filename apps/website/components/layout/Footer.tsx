import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-cba-green text-white">
      <div className="container-section py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold">Cornell Business Analytics</p>
            <p className="mt-2 text-sm text-gray-300">
              Data-driven solutions for data-driven clients.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Navigation
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { href: "/about", label: "About" },
                { href: "/team", label: "Team" },
                { href: "/clients", label: "Clients" },
                { href: "/recruitment", label: "Recruitment" },
                { href: "/contact", label: "Contact" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-gray-300 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Connect
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>
                <a
                  href="mailto:cornellbusinessanalytics@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  cornellbusinessanalytics@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/cornellbusinessanalytics/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/cornell-business-analytics/posts/?feedView=all"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-xs text-gray-400">
          <p>Cornell Business Analytics is a registered student organization at Cornell University.</p>
          <p className="mt-1">
            Cornell University is an equal opportunity, affirmative action educator and employer.
          </p>
        </div>
      </div>
    </footer>
  );
}
