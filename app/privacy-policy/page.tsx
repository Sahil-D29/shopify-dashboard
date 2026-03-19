export const metadata = {
  title: 'Privacy Policy - Dorec WhatsApp Software',
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', color: '#333' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Last updated: March 19, 2026</p>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>1. Introduction</h2>
        <p>Dorec WhatsApp Software (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a WhatsApp Business integration platform that enables Shopify store owners to connect and communicate with their customers via WhatsApp. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>2. Information We Collect</h2>
        <p><strong>Account Information:</strong> When you sign up or connect via Facebook Login, we collect your name, email address, and Facebook/Meta account identifiers necessary for WhatsApp Business API integration.</p>
        <p><strong>WhatsApp Business Data:</strong> We collect your WhatsApp Business Account ID, phone number ID, and access tokens required to send and receive messages on your behalf.</p>
        <p><strong>Customer Communication Data:</strong> Messages sent and received through our platform between you and your customers, including text content, timestamps, and delivery status.</p>
        <p><strong>Shopify Store Data:</strong> Store name, store ID, and order-related information necessary to provide customer support and messaging features.</p>
        <p><strong>Usage Data:</strong> We automatically collect information about how you interact with our service, including pages visited, features used, and error logs.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>3. How We Use Your Information</h2>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>To provide and maintain our WhatsApp messaging service</li>
          <li>To authenticate your identity via Facebook Login</li>
          <li>To connect your Shopify store with WhatsApp Business API</li>
          <li>To send and receive WhatsApp messages on your behalf</li>
          <li>To manage message templates and campaigns</li>
          <li>To provide customer support</li>
          <li>To improve and optimize our service</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>4. Data Sharing and Disclosure</h2>
        <p>We share your information only in the following circumstances:</p>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li><strong>Meta/WhatsApp:</strong> To facilitate WhatsApp Business API communication, your business information and messages are processed through Meta&apos;s WhatsApp Business Platform.</li>
          <li><strong>Shopify:</strong> We integrate with your Shopify store to access order and customer data as authorized by you.</li>
          <li><strong>Service Providers:</strong> We may use third-party hosting and infrastructure providers to operate our service.</li>
          <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests.</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>5. Data Security</h2>
        <p>We implement appropriate technical and organizational security measures to protect your data, including encryption of data in transit using HTTPS, secure storage of access tokens, and restricted access controls. However, no method of electronic transmission or storage is 100% secure.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>6. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as needed to provide our services. You may request deletion of your data at any time by contacting us. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>7. Your Rights</h2>
        <p>Depending on your location, you may have the following rights:</p>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>Access and receive a copy of your personal data</li>
          <li>Rectify inaccurate personal data</li>
          <li>Request deletion of your personal data</li>
          <li>Object to or restrict processing of your data</li>
          <li>Data portability</li>
          <li>Withdraw consent at any time</li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>8. Third-Party Services</h2>
        <p>Our service integrates with Meta (Facebook/WhatsApp) and Shopify. Your use of these third-party services is governed by their respective privacy policies. We encourage you to review their privacy policies.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised &quot;Last updated&quot; date.</p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>10. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or our data practices, please contact us at:</p>
        <p><strong>Email:</strong> support@dorecwhatsapp.com</p>
      </section>
    </div>
  )
}
