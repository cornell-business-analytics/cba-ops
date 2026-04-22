import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { ContactForm } from "@/components/sections/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Cornell Business Analytics.",
};

export default function ContactPage() {
  return (
    <>
      <Hero heading="Get in touch" subheading="We'd love to hear from you — whether you're a prospective client, a prospective member, or just curious about what we do." />

      <section className="container-section py-16">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-cba-dark">Send us a message</h2>
            <p className="mt-2 text-sm text-gray-500">We typically respond within 2–3 business days.</p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-cba-dark">Other ways to reach us</h2>
            <ul className="mt-6 space-y-5">
              <li>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <a
                  href="mailto:cornellbusinessanalytics@gmail.com"
                  className="mt-0.5 block font-medium text-cba-green hover:underline"
                >
                  cornellbusinessanalytics@gmail.com
                </a>
              </li>
              <li>
                <p className="text-sm font-medium text-gray-500">Instagram</p>
                <a
                  href="https://www.instagram.com/cornellbusinessanalytics/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block font-medium text-cba-green hover:underline"
                >
                  @cornellbusinessanalytics
                </a>
              </li>
              <li>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="mt-0.5 font-medium text-cba-dark">Cornell University, Ithaca, NY 14853</p>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
