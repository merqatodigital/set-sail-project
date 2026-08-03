export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20 lg:px-12 lg:py-32">
      <h1 className="font-serif text-3xl font-light text-[#26221C] sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[#26221C]/50">Last updated: August 4, 2026</p>

      <div className="mt-8 space-y-6 text-[13px] leading-relaxed text-[#26221C]/70 sm:text-sm">
        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">1. Information We Collect</h2>
          <p>When you use TALA (our AI concierge) or the Guest Portal, we may collect:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Name and phone number (provided during booking or chat)</li>
            <li>Email address (optional, for booking confirmations)</li>
            <li>Booking details (dates, room type, guests)</li>
            <li>Chat messages with TALA (for service improvement and follow-up)</li>
            <li>Device information (browser type, screen size — for responsive design)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">2. How We Use Your Information</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>To process and manage your bookings</li>
            <li>To provide concierge services through TALA</li>
            <li>To communicate about your stay, tours, and services</li>
            <li>To improve our website and guest experience</li>
            <li>To send follow-up messages after your stay (with your consent)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">3. Data Sharing</h2>
          <p>We do not sell or rent your personal information to third parties. We may share your data with:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Supabase (our database provider) — for secure data storage</li>
            <li>OpenRouter (AI service provider) — for TALA's chat responses</li>
            <li>WhatsApp — if you choose to contact us via WhatsApp</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">4. Data Security</h2>
          <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">5. Your Rights</h2>
          <p>Under the Philippine Data Privacy Act of 2012, you have the right to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Access your personal data</li>
            <li>Correct any inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to the processing of your data</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">6. Cookies</h2>
          <p>Our website uses essential cookies for functionality. We do not use third-party tracking cookies without your consent.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">7. Contact Us</h2>
          <p>For privacy-related inquiries, contact us at privacy@marinaterrace.com or through our WhatsApp channel.</p>
        </section>
      </div>
    </div>
  );
}
