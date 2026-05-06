import {
  formatINR,
  formatIST,
  istGreeting,
  toHindiAmountWord,
  festivalOn,
  isIndiaBusinessHour,
  KNOWN_UPI_PSPS
} from '@ather/india';

type Feature = {
  title: string;
  titleHi: string;
  description: string;
  status: 'shipping' | 'in-progress' | 'planned';
  pillar: 'creator' | 'safety' | 'ai' | 'bharat' | 'platform';
};

const FEATURES: Feature[] = [
  {
    title: 'UPI Tipping',
    titleHi: 'यूपीआई से टिप दीजिए',
    description:
      'Tip any creator instantly via UPI VPA. Settles in seconds, no card needed. Supports PhonePe, Google Pay, Paytm, BHIM and bank handles.',
    status: 'in-progress',
    pillar: 'creator'
  },
  {
    title: 'Bharat Creator Studio',
    titleHi: 'भारत क्रिएटर स्टूडियो',
    description:
      'Earnings in ₹ with lakh/crore breakdowns, GST-ready invoices, TDS summaries, and same-day payouts to any Indian bank account.',
    status: 'in-progress',
    pillar: 'creator'
  },
  {
    title: 'Regional-Language Feed',
    titleHi: 'क्षेत्रीय भाषा फ़ीड',
    description:
      'First-class feeds in हिन्दी, தமிழ், తెలుగు, বাংলা, मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ — with on-demand translation.',
    status: 'planned',
    pillar: 'bharat'
  },
  {
    title: 'DPDP Teen Mode',
    titleHi: 'किशोर सुरक्षा मोड',
    description:
      'Default-private accounts for under-18s, restricted DMs, daily screen-time caps and parental linking — aligned with the DPDP Act, 2023.',
    status: 'planned',
    pillar: 'safety'
  },
  {
    title: 'IST-Aware Notifications',
    titleHi: 'समय-संवेदी सूचनाएँ',
    description:
      'Notifications honour Indian sleep hours. Non-urgent posts batch overnight; replies surface 09:00–21:00 IST by default.',
    status: 'shipping',
    pillar: 'ai'
  },
  {
    title: 'Festival Themes',
    titleHi: 'त्यौहार थीम',
    description:
      'Auto-themed app for Diwali, Holi, Eid, Onam, Pongal, Republic Day, Independence Day. Stickers, frames and effects packs by region.',
    status: 'shipping',
    pillar: 'bharat'
  },
  {
    title: 'Aadhaar / PAN Redaction',
    titleHi: 'आधार-पैन ऑटो-छिपाव',
    description:
      'Posts and DMs are scanned client-side; obvious Aadhaar and PAN numbers are masked before they ever leave the device.',
    status: 'shipping',
    pillar: 'safety'
  },
  {
    title: 'GST-Ready Marketplace',
    titleHi: 'जीएसटी-रेडी बाज़ार',
    description:
      'CGST + SGST or IGST is computed automatically on every sale. HSN codes, e-invoice JSON and monthly GSTR-1 export built in.',
    status: 'planned',
    pillar: 'creator'
  },
  {
    title: 'Voice-First Onboarding',
    titleHi: 'आवाज़ से ऑनबोर्डिंग',
    description:
      'Sign up by speaking — works in 12+ Indian languages, including for first-time smartphone users on entry-level Android phones.',
    status: 'planned',
    pillar: 'ai'
  },
  {
    title: 'Lite Mode (under 5 MB)',
    titleHi: 'लाइट मोड',
    description:
      'A stripped-down app that runs on 2G/3G and ₹5,000 phones. Zero auto-play, image-first, key-pad navigation.',
    status: 'planned',
    pillar: 'bharat'
  },
  {
    title: 'Communities with Treasury',
    titleHi: 'समुदाय कोष',
    description:
      'Communities can collect tips into a shared ₹ treasury and split it among contributors via on-ledger rules — no crypto, fully compliant.',
    status: 'planned',
    pillar: 'creator'
  },
  {
    title: 'AI Content Provenance',
    titleHi: 'एआई सामग्री प्रमाण',
    description:
      'Every upload is C2PA-signed at capture. Feed shows clear "human", "AI-assisted" or "AI-generated" badges to fight deepfakes.',
    status: 'in-progress',
    pillar: 'safety'
  },
  {
    title: 'Mini-Apps (à la Bharat Stack)',
    titleHi: 'मिनी-ऐप्स',
    description:
      'Order food, pay bills, book IRCTC tickets, run UPI collect requests — all inside Ather, with capability-sandboxed mini-apps.',
    status: 'planned',
    pillar: 'platform'
  },
  {
    title: 'Personal AI Twin',
    titleHi: 'आपका एआई जुड़वाँ',
    description:
      'A private model that learns your style and replies on your behalf in low-stakes group chats. Opt-in, on-device when possible.',
    status: 'planned',
    pillar: 'ai'
  },
  {
    title: 'E2EE DMs (Signal protocol)',
    titleHi: 'एंड-टू-एंड एन्क्रिप्टेड DM',
    description:
      'Server stores ciphertext only. Sealed-sender metadata. Disappearing messages with verifiable deletion receipts.',
    status: 'in-progress',
    pillar: 'safety'
  },
  {
    title: 'Cricket & Election Surfaces',
    titleHi: 'क्रिकेट और चुनाव',
    description:
      'Live cricket score overlays, ball-by-ball reactions, and election-integrity policy with verified-source labels — built for India\u2019s biggest moments.',
    status: 'planned',
    pillar: 'bharat'
  }
];

const PILLAR_CLASS: Record<Feature['pillar'], string> = {
  creator: 'tag',
  safety: 'tag green',
  ai: 'tag blue',
  bharat: 'tag',
  platform: 'tag green'
};

const PILLAR_LABEL: Record<Feature['pillar'], string> = {
  creator: 'Creator',
  safety: 'Safety',
  ai: 'AI',
  bharat: 'Bharat',
  platform: 'Platform'
};

const STATUS_LABEL: Record<Feature['status'], string> = {
  shipping: 'shipping',
  'in-progress': 'in-progress',
  planned: 'planned'
};

export default function HomePage() {
  // Render-time demo using @ather/india. Picks the request time so the page
  // is not statically frozen on build day.
  const now = new Date();
  const greetingEn = istGreeting('en', now);
  const greetingHi = istGreeting('hi', now);
  const istNow = formatIST(now);
  const businessHour = isIndiaBusinessHour(now);
  const festival = festivalOn(now);

  // Sample creator earnings demo: 12.5 lakh paise → ₹12,500.00 + Hindi word form.
  const sampleEarningsPaise = 12_50_000_00; // ₹12,50,000.00 = 12.5 lakh
  const sampleEarningsRupees = sampleEarningsPaise / 100;

  return (
    <main>
      <div className="tricolour" aria-hidden="true">
        <span className="saffron" />
        <span className="white" />
        <span className="green" />
      </div>

      <section className="hero">
        <div className="greeting">
          <span className="dot" aria-hidden="true" />
          <span>
            {greetingEn} · {greetingHi} — {istNow}
            {businessHour ? ' · 🟢 active hours' : ' · 🌙 quiet hours'}
          </span>
        </div>
        <span className="tag">Bharat-First · भारत-प्रथम</span>
        <h1>Ather — आपका सोशल OS</h1>
        <p className="hi">एक ऐप, अनेक भाषाएँ, हर भारतीय के लिए।</p>
        <p className="lead">
          One identity for posts, chats, communities, payments and creator
          earnings — built for India first. UPI-native. Regional-language
          fluent. DPDP-compliant. Zero deepfakes by default.
        </p>
      </section>

      {festival && (
        <div className="festival-banner" role="note">
          🎉 <strong>{festival.name}</strong> · {festival.nameHi} — Ather
          wishes you and your family a wonderful day.
        </div>
      )}

      <section className="demo" aria-label="Live demo of @ather/india utilities">
        <div className="cell">
          <span className="k">Sample creator earnings</span>
          <span className="v">{formatINR(sampleEarningsPaise)}</span>
          <span className="k">{toHindiAmountWord(sampleEarningsRupees)} रुपये</span>
        </div>
        <div className="cell">
          <span className="k">UPI handles supported</span>
          <span className="v">{KNOWN_UPI_PSPS.length}+ PSPs</span>
          <span className="k">@oksbi · @ybl · @paytm · @apl …</span>
        </div>
        <div className="cell">
          <span className="k">Time zone</span>
          <span className="v">Asia/Kolkata</span>
          <span className="k">UTC+05:30 · no DST</span>
        </div>
        <div className="cell">
          <span className="k">Compliance</span>
          <span className="v">DPDP · GST · RBI</span>
          <span className="k">PII redaction · KYC-ready</span>
        </div>
      </section>

      <h2>उन्नत सुविधाएँ · Advanced features for Bharat</h2>
      <p className="section-sub">
        The next slice of the Ather roadmap, framed for Indian users and
        creators. Status reflects where it sits in the Phase 3+ plan.
      </p>

      <div className="grid">
        {FEATURES.map((f) => (
          <div className="card" key={f.title}>
            <span className={PILLAR_CLASS[f.pillar]}>
              {PILLAR_LABEL[f.pillar]} · {STATUS_LABEL[f.status]}
            </span>
            <h3>{f.title}</h3>
            <span className="hi-label">{f.titleHi}</span>
            <p>{f.description}</p>
          </div>
        ))}
      </div>

      <footer>
        <span>Made in India · भारत में निर्मित</span>
        <span>
          <a href="https://github.com/ajay35247/Ather/tree/main/docs">
            architecture · /docs
          </a>
        </span>
      </footer>
    </main>
  );
}
