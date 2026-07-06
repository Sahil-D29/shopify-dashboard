# App Review — Test Instructions (Shopify 4.5.5)

Paste the relevant parts of this into the **"Testing instructions / notes for reviewer"** field
in the Partner Dashboard submission.

## Test credentials

- App URL: https://app.dorza.io
- Email: `<REVIEW_LOGIN_EMAIL>`
- Password: `<REVIEW_LOGIN_PASSWORD>`

(Replace with the reviewer login you provide. This account should already have the review
Shopify store connected, or the reviewer can connect one from Settings → Shopify.)

## No WhatsApp account needed — Sandbox mode

You do **not** need a Facebook login or a WhatsApp Business Account to test this app.

When a store has **no WhatsApp connection**, the app runs in **Sandbox mode**: every WhatsApp
send is **simulated** (recorded as delivered, but not actually sent to Meta). This lets you
exercise the complete feature set — campaigns, journeys/automations, cart recovery, and test
sends — end to end. A yellow **"Sandbox mode active"** banner is shown on the Campaigns and
Settings → WhatsApp pages to make this explicit.

(If you later connect a real WhatsApp Business Account in Settings → WhatsApp, sends become
real. Connected stores are unaffected by Sandbox mode.)

## What to test

### 1. Message template
1. Go to **Templates → Create Template**. Give it a name, category, language, and body, then save.
2. It appears in your template list (status "Draft"). It is immediately usable in Sandbox mode —
   no Meta approval required.

### 2. Campaign
1. Go to **Campaigns → Create Campaign**.
2. Step 1: name it. Step 2: pick an audience segment (the connected store's customers/contacts).
3. Step 3: click **Choose Template**, pick the template you created, and (optionally) add filters.
4. Step 4: **Send immediately**. Step 5: **Launch Campaign**.
5. The campaign moves to **Completed** with a **Sent** count. (Sends are simulated in Sandbox.)
6. **Send Test** (Step 3) also returns a "Test message simulated (Sandbox mode…)" success.

### 3. Journey / automation
1. Go to **Journeys → Create Journey**.
2. Open the trigger node → **Trigger Type = Event Trigger** → pick an event (e.g. "Order Placed",
   "Product Viewed", "WhatsApp Reply Received") and, optionally, add filters.
3. Add a **Send WhatsApp** action, then **Activate** the journey. Matching events enroll contacts;
   the send action is simulated in Sandbox.

### 4. Cart recovery
1. Use the **Abandoned Cart Recovery** campaign preset (Campaigns → Create → preset) or an
   **Abandoned Cart** journey trigger, add a message, and launch/activate. Behaves as above in
   Sandbox mode.

## Notes
- Sandbox is automatic (no toggle) whenever WhatsApp is not connected for the store.
- To force it globally (e.g. for a dedicated review deployment), set env `WHATSAPP_SANDBOX=true`.
