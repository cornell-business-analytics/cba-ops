import Link from "next/link";

interface HeroProps {
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: string;
}

export function Hero({ heading, subheading, ctaLabel, ctaHref, image }: HeroProps) {
  return (
    <section className="relative text-white" aria-label="Hero">
      {image ? (
        <>
          {/* Image sets the section height — no cropping */}
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="block w-full h-auto"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-cba-dark/85 via-cba-dark/60 to-cba-dark/30" />
          <div className="absolute inset-0 flex items-center">
            <div className="container-section w-full">
              <div className="max-w-2xl xl:max-w-3xl">
                <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                  {heading}
                </h1>
                {subheading && (
                  <p className="mt-6 text-lg leading-relaxed text-gray-200 sm:text-xl">
                    {subheading}
                  </p>
                )}
                {ctaLabel && ctaHref && (
                  <div className="mt-10 flex flex-wrap gap-4">
                    <Link
                      href={ctaHref}
                      className="rounded-md bg-cba-green px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cba-green-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cba-green"
                    >
                      {ctaLabel}
                    </Link>
                    <Link
                      href="/about"
                      className="rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                    >
                      Learn more
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-cba-dark" />
          <div className="relative container-section py-28 sm:py-36 lg:py-44 xl:py-52">
            <div className="max-w-2xl xl:max-w-3xl">
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                {heading}
              </h1>
              {subheading && (
                <p className="mt-6 text-lg leading-relaxed text-gray-200 sm:text-xl">
                  {subheading}
                </p>
              )}
              {ctaLabel && ctaHref && (
                <div className="mt-10 flex flex-wrap gap-4">
                  <Link
                    href={ctaHref}
                    className="rounded-md bg-cba-green px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cba-green-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cba-green"
                  >
                    {ctaLabel}
                  </Link>
                  <Link
                    href="/about"
                    className="rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                  >
                    Learn more
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
