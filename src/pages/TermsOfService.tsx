export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20 lg:px-12 lg:py-32">
      <h1 className="font-serif text-3xl font-light text-[#26221C] sm:text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-[#26221C]/50">Last updated: August 4, 2026</p>

      <div className="mt-8 space-y-6 text-[13px] leading-relaxed text-[#26221C]/70 sm:text-sm">
        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">1. Acceptance of Terms</h2>
          <p>By accessing or using the Marina Terrace website, TALA AI concierge, or Guest Portal, you agree to these Terms of Service.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">2. Booking Terms</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>All bookings are subject to availability and confirmation by our team</li>
            <li>TALA may draft bookings on your behalf, but final confirmation requires human verification</li>
            <li>Cancellation policies vary by room type and season — contact us for details</li>
            <li>Prices are in Philippine Pesos (PHP) unless otherwise stated</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">3. AI Concierge (TALA)</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>TALA is an AI assistant — responses are generated and may occasionally be inaccurate</li>
            <li>TALA cannot process payments or access sensitive financial information</li>
            <li>For urgent or complex requests, TALA will connect you with our human team</li>
            <li>Chat conversations may be logged for quality improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">4. Guest Portal</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Portal access is linked to your booking (phone + name verification)</li>
            <li>You are responsible for keeping your access credentials secure</li>
            <li>Do not share your portal access with non-guests</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">5. Limitation of Liability</h2>
          <p>Marina Terrace is not liable for any indirect, incidental, or consequential damages arising from the use of our website, AI concierge, or guest portal.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">6. Governing Law</h2>
          <p>These terms are governed by the laws of the Republic of the Philippines.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">7. Contact</h2>
          <p>For questions about these terms, contact us at legal@marinaterrace.com or via WhatsApp.</p>
        </section>
      </div>
    </div>
  );
}
