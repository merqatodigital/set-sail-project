export default function AccessibilityStatement() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20 lg:px-12 lg:py-32">
      <h1 className="font-serif text-3xl font-light text-[#26221C] sm:text-4xl">Accessibility Statement</h1>
      <p className="mt-2 text-sm text-[#26221C]/50">Last updated: August 4, 2026</p>

      <div className="mt-8 space-y-6 text-[13px] leading-relaxed text-[#26221C]/70 sm:text-sm">
        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Our Commitment</h2>
          <p>Marina Terrace is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Standards We Follow</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>WCAG 2.1 Level AA compliance target</li>
            <li>Semantic HTML structure throughout the site</li>
            <li>Keyboard navigation support for all interactive elements</li>
            <li>Screen reader compatibility with ARIA labels and roles</li>
            <li>Sufficient color contrast for text readability</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Accessibility Features</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Skip-to-content navigation link</li>
            <li>Descriptive alt text on all images</li>
            <li>Form labels associated with input fields</li>
            <li>Focus indicators on interactive elements</li>
            <li>Responsive design for all screen sizes</li>
            <li>AI concierge (TALA) with voice input/output options</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Known Limitations</h2>
          <p>We are working to address the following accessibility issues:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Some older blog content may have images without full alt text</li>
            <li>Third-party embedded content (Instagram, YouTube) may not be fully accessible</li>
            <li>TALA's voice output may not work in all browsers (falls back to text)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Feedback</h2>
          <p>We welcome your feedback on the accessibility of our website. Please contact us at:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Email: accessibility@marinaterrace.com</li>
            <li>WhatsApp: Contact us for accessibility support</li>
          </ul>
          <p className="mt-2">We aim to respond to accessibility feedback within 2 business days.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-lg font-medium text-[#26221C]">Compatibility</h2>
          <p>This website is designed to be compatible with:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Modern browsers (Chrome, Firefox, Safari, Edge)</li>
            <li>Mobile devices (iOS and Android)</li>
            <li>Screen readers (NVDA, JAWS, VoiceOver)</li>
            <li>Keyboard-only navigation</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
