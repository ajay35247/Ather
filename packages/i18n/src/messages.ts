import type { LocaleCode } from './locales';

/**
 * Translation message keys used across the Ather web app and services.
 * When adding a key, add an English entry first — every other locale
 * falls back to English at runtime if missing.
 */
export type MessageKey =
  | 'tagline'
  | 'heroTitle'
  | 'heroSub'
  | 'heroLead'
  | 'bharatFirst'
  | 'featuresHeading'
  | 'featuresSub'
  | 'chooseLanguage'
  | 'languagesSupported'
  | 'madeIn'
  | 'seeArchitecture'
  | 'quietHours'
  | 'activeHours'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'hello'
  | 'sampleEarnings'
  | 'compliance'
  | 'timezone'
  | 'upiPsps';

export type Messages = Partial<Record<MessageKey, string>>;

/**
 * English is the canonical complete table. All keys must be present.
 */
const en: Required<Messages> = {
  tagline: 'Your social OS — one identity for posts, chats, communities, payments and creator earnings.',
  heroTitle: 'Ather — Your Social OS',
  heroSub: 'One app, every language, every Indian.',
  heroLead:
    'One identity for posts, chats, communities, payments and creator earnings — built for India first. UPI-native. Multilingual. DPDP-compliant. Zero deepfakes by default.',
  bharatFirst: 'Bharat-First',
  featuresHeading: 'Advanced features for Bharat',
  featuresSub:
    'The next slice of the Ather roadmap, framed for Indian users and creators.',
  chooseLanguage: 'Choose language',
  languagesSupported: 'languages supported',
  madeIn: 'Made in India',
  seeArchitecture: 'architecture · /docs',
  quietHours: 'quiet hours',
  activeHours: 'active hours',
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  hello: 'Hello',
  sampleEarnings: 'Sample creator earnings',
  compliance: 'Compliance',
  timezone: 'Time zone',
  upiPsps: 'UPI handles supported'
};

// ---------- Indian languages (Eighth Schedule) ----------

const hi: Messages = {
  tagline: 'आपका सोशल OS — पोस्ट, चैट, समुदाय, भुगतान और क्रिएटर कमाई के लिए एक पहचान।',
  heroTitle: 'Ather — आपका सोशल OS',
  heroSub: 'एक ऐप, अनेक भाषाएँ, हर भारतीय के लिए।',
  heroLead:
    'पोस्ट, चैट, समुदाय, भुगतान और क्रिएटर कमाई के लिए एक ही पहचान — भारत के लिए बना। UPI-नेटिव। बहुभाषी। DPDP-अनुपालक।',
  bharatFirst: 'भारत-प्रथम',
  featuresHeading: 'भारत के लिए उन्नत सुविधाएँ',
  featuresSub: 'Ather रोडमैप का अगला हिस्सा, भारतीय यूज़र और क्रिएटर्स के लिए।',
  chooseLanguage: 'भाषा चुनें',
  languagesSupported: 'भाषाओं में उपलब्ध',
  madeIn: 'भारत में निर्मित',
  seeArchitecture: 'आर्किटेक्चर · /docs',
  quietHours: 'शांत समय',
  activeHours: 'सक्रिय समय',
  morning: 'सुप्रभात',
  afternoon: 'नमस्कार',
  evening: 'शुभ संध्या',
  hello: 'नमस्ते',
  sampleEarnings: 'नमूना क्रिएटर कमाई',
  compliance: 'अनुपालन',
  timezone: 'समय क्षेत्र',
  upiPsps: 'समर्थित UPI हैंडल'
};

const bn: Messages = {
  heroTitle: 'Ather — আপনার সোশ্যাল OS',
  heroSub: 'একটি অ্যাপ, সব ভাষা, প্রতিটি ভারতীয়।',
  bharatFirst: 'ভারত-প্রথম',
  featuresHeading: 'ভারতের জন্য উন্নত বৈশিষ্ট্য',
  chooseLanguage: 'ভাষা বেছে নিন',
  madeIn: 'ভারতে তৈরি',
  morning: 'শুভ সকাল',
  afternoon: 'শুভ অপরাহ্ন',
  evening: 'শুভ সন্ধ্যা',
  hello: 'নমস্কার'
};

const ta: Messages = {
  heroTitle: 'Ather — உங்கள் சமூக OS',
  heroSub: 'ஒரு செயலி, எல்லா மொழிகள், ஒவ்வொரு இந்தியருக்கும்.',
  bharatFirst: 'பாரதம் முதலில்',
  featuresHeading: 'பாரதத்திற்கான மேம்பட்ட அம்சங்கள்',
  chooseLanguage: 'மொழியைத் தேர்ந்தெடு',
  madeIn: 'இந்தியாவில் உருவாக்கப்பட்டது',
  morning: 'காலை வணக்கம்',
  afternoon: 'மதிய வணக்கம்',
  evening: 'மாலை வணக்கம்',
  hello: 'வணக்கம்'
};

const te: Messages = {
  heroTitle: 'Ather — మీ సోషల్ OS',
  heroSub: 'ఒకే యాప్, అన్ని భాషలు, ప్రతి భారతీయుడికి.',
  bharatFirst: 'భారత్ ప్రథమం',
  featuresHeading: 'భారతదేశం కోసం అధునాతన ఫీచర్లు',
  chooseLanguage: 'భాష ఎంచుకోండి',
  madeIn: 'భారతదేశంలో తయారు',
  morning: 'శుభోదయం',
  afternoon: 'శుభ మధ్యాహ్నం',
  evening: 'శుభ సాయంత్రం',
  hello: 'నమస్కారం'
};

const mr: Messages = {
  heroTitle: 'Ather — तुमचा सोशल OS',
  heroSub: 'एक अ‍ॅप, सर्व भाषा, प्रत्येक भारतीयासाठी.',
  bharatFirst: 'भारत-प्रथम',
  featuresHeading: 'भारतासाठी प्रगत वैशिष्ट्ये',
  chooseLanguage: 'भाषा निवडा',
  madeIn: 'भारतात बनवलेले',
  morning: 'सुप्रभात',
  afternoon: 'नमस्कार',
  evening: 'शुभ संध्याकाळ',
  hello: 'नमस्कार'
};

const gu: Messages = {
  heroTitle: 'Ather — તમારું સોશિયલ OS',
  heroSub: 'એક એપ, બધી ભાષાઓ, દરેક ભારતીય માટે.',
  bharatFirst: 'ભારત-પ્રથમ',
  featuresHeading: 'ભારત માટે અદ્યતન સુવિધાઓ',
  chooseLanguage: 'ભાષા પસંદ કરો',
  madeIn: 'ભારતમાં બનેલું',
  morning: 'સુપ્રભાત',
  afternoon: 'નમસ્કાર',
  evening: 'શુભ સંધ્યા',
  hello: 'નમસ્તે'
};

const kn: Messages = {
  heroTitle: 'Ather — ನಿಮ್ಮ ಸೋಶಿಯಲ್ OS',
  heroSub: 'ಒಂದೇ ಆ್ಯಪ್, ಎಲ್ಲಾ ಭಾಷೆಗಳು, ಪ್ರತಿ ಭಾರತೀಯನಿಗೆ.',
  bharatFirst: 'ಭಾರತ-ಪ್ರಥಮ',
  featuresHeading: 'ಭಾರತಕ್ಕಾಗಿ ಮುಂದುವರಿದ ವೈಶಿಷ್ಟ್ಯಗಳು',
  chooseLanguage: 'ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ',
  madeIn: 'ಭಾರತದಲ್ಲಿ ತಯಾರಿಸಲಾಗಿದೆ',
  morning: 'ಶುಭೋದಯ',
  afternoon: 'ನಮಸ್ಕಾರ',
  evening: 'ಶುಭ ಸಂಜೆ',
  hello: 'ನಮಸ್ಕಾರ'
};

const ml: Messages = {
  heroTitle: 'Ather — നിങ്ങളുടെ സോഷ്യൽ OS',
  heroSub: 'ഒരു ആപ്പ്, എല്ലാ ഭാഷകളും, എല്ലാ ഇന്ത്യക്കാർക്കും.',
  bharatFirst: 'ഭാരതം ആദ്യം',
  featuresHeading: 'ഭാരതത്തിനായുള്ള നൂതന സവിശേഷതകൾ',
  chooseLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
  madeIn: 'ഇന്ത്യയിൽ നിർമ്മിച്ചത്',
  morning: 'സുപ്രഭാതം',
  afternoon: 'നമസ്കാരം',
  evening: 'ശുഭ സന്ധ്യ',
  hello: 'നമസ്കാരം'
};

const pa: Messages = {
  heroTitle: 'Ather — ਤੁਹਾਡਾ ਸੋਸ਼ਲ OS',
  heroSub: 'ਇੱਕ ਐਪ, ਸਾਰੀਆਂ ਭਾਸ਼ਾਵਾਂ, ਹਰੇਕ ਭਾਰਤੀ ਲਈ।',
  bharatFirst: 'ਭਾਰਤ-ਪ੍ਰਥਮ',
  featuresHeading: 'ਭਾਰਤ ਲਈ ਉੱਨਤ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ',
  chooseLanguage: 'ਭਾਸ਼ਾ ਚੁਣੋ',
  madeIn: 'ਭਾਰਤ ਵਿੱਚ ਬਣਾਇਆ',
  morning: 'ਸ਼ੁਭ ਸਵੇਰ',
  afternoon: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
  evening: 'ਸ਼ੁਭ ਸ਼ਾਮ',
  hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'
};

const or: Messages = {
  heroTitle: 'Ather — ଆପଣଙ୍କର ସୋସିଆଲ୍ OS',
  heroSub: 'ଗୋଟିଏ ଆପ୍, ସମସ୍ତ ଭାଷା, ପ୍ରତ୍ୟେକ ଭାରତୀୟଙ୍କ ପାଇଁ।',
  bharatFirst: 'ଭାରତ-ପ୍ରଥମ',
  chooseLanguage: 'ଭାଷା ବାଛନ୍ତୁ',
  madeIn: 'ଭାରତରେ ନିର୍ମିତ',
  morning: 'ଶୁଭ ସକାଳ',
  afternoon: 'ନମସ୍କାର',
  evening: 'ଶୁଭ ସନ୍ଧ୍ୟା',
  hello: 'ନମସ୍କାର'
};

const as: Messages = {
  heroTitle: 'Ather — আপোনাৰ ছ’চিয়েল OS',
  heroSub: 'এটা এপ, সকলো ভাষা, প্ৰতিজন ভাৰতীয়ৰ বাবে।',
  bharatFirst: 'ভাৰত-প্ৰথম',
  chooseLanguage: 'ভাষা বাছনি কৰক',
  madeIn: 'ভাৰতত নিৰ্মিত',
  morning: 'সুপ্ৰভাত',
  afternoon: 'নমস্কাৰ',
  evening: 'শুভ সন্ধিয়া',
  hello: 'নমস্কাৰ'
};

const ne: Messages = {
  heroTitle: 'Ather — तपाईंको सोसियल OS',
  heroSub: 'एउटै एप, सबै भाषा, हरेक भारतीयको लागि।',
  bharatFirst: 'भारत-प्रथम',
  chooseLanguage: 'भाषा छान्नुहोस्',
  madeIn: 'भारतमा निर्मित',
  morning: 'शुभ प्रभात',
  afternoon: 'नमस्कार',
  evening: 'शुभ साँझ',
  hello: 'नमस्ते'
};

const sa: Messages = {
  heroTitle: 'Ather — भवतः सामाजिकं OS',
  heroSub: 'एकं उपयोजनम्, सर्वाः भाषाः, प्रत्येकः भारतीयः।',
  bharatFirst: 'भारतम् प्रथमम्',
  chooseLanguage: 'भाषां चिनुत',
  madeIn: 'भारते निर्मितम्',
  morning: 'सुप्रभातम्',
  afternoon: 'नमस्कारः',
  evening: 'शुभ सायं',
  hello: 'नमस्ते'
};

const ur: Messages = {
  heroTitle: 'Ather — آپ کا سوشل OS',
  heroSub: 'ایک ایپ، ہر زبان، ہر ہندوستانی کے لیے۔',
  bharatFirst: 'بھارت اول',
  featuresHeading: 'بھارت کے لیے جدید خصوصیات',
  chooseLanguage: 'زبان منتخب کریں',
  madeIn: 'ہندوستان میں تیار',
  morning: 'صبح بخیر',
  afternoon: 'سلام',
  evening: 'شام بخیر',
  hello: 'السلام علیکم'
};

const ks: Messages = {
  heroTitle: 'Ather — تُہٕنٛد سوشَل OS',
  heroSub: 'اَکھ ایٕپ، سٲری زَبان، ہٕر ہِندٕستٲنی خٲطرٕ',
  chooseLanguage: 'زَبان ژارِو',
  madeIn: 'ہِندٕستٲنَس مَنٛز بَنٲوِتھ',
  hello: 'سَلام'
};

const sd: Messages = {
  heroTitle: 'Ather — توهان جو سوشل OS',
  heroSub: 'هڪ ايپ، سڀ ٻوليون، هر هندستاني لاءِ.',
  chooseLanguage: 'ٻولي چونڊيو',
  madeIn: 'هندستان ۾ ٺهيل',
  hello: 'سلام'
};

const brx: Messages = {
  heroTitle: 'Ather — नोंथांनि सोसियाल OS',
  chooseLanguage: 'राव सायख',
  madeIn: 'भारतआव बानायजागौ',
  hello: 'नमस्कार'
};

const doi: Messages = {
  heroTitle: 'Ather — तुंदा सोशल OS',
  chooseLanguage: 'बोली चुनो',
  madeIn: 'भारत च बणाया',
  hello: 'नमस्ते'
};

const gom: Messages = {
  heroTitle: 'Ather — तुमचो सोशल OS',
  chooseLanguage: 'भास निवडात',
  madeIn: 'भारतांत तयार केलें',
  hello: 'नमस्कार'
};

const mai: Messages = {
  heroTitle: 'Ather — अहाँक सोशल OS',
  chooseLanguage: 'भाषा चुनू',
  madeIn: 'भारत मे बनल',
  hello: 'प्रणाम'
};

const mni: Messages = {
  heroTitle: 'Ather — Adugi Social OS',
  chooseLanguage: 'Lon khallu',
  madeIn: 'Bharat-da semba',
  hello: 'Khurumjari'
};

const sat: Messages = {
  heroTitle: 'Ather — ᱟᱢᱟᱜ ᱥᱳᱥᱤᱭᱟᱞ OS',
  chooseLanguage: 'ᱯᱟᱹᱨᱥᱤ ᱥᱟᱹᱜᱟᱹᱭ ᱢᱮ',
  madeIn: 'ᱵᱷᱟᱨᱚᱛ ᱨᱮ ᱛᱮᱭᱟᱨ',
  hello: 'ᱡᱚᱦᱟᱨ'
};

// ---------- World languages ----------

const es: Messages = {
  heroTitle: 'Ather — Tu Sistema Social',
  heroSub: 'Una app, todos los idiomas, para cada persona.',
  bharatFirst: 'India primero',
  featuresHeading: 'Funciones avanzadas para Bharat',
  chooseLanguage: 'Elige idioma',
  languagesSupported: 'idiomas compatibles',
  madeIn: 'Hecho en India',
  morning: 'Buenos días',
  afternoon: 'Buenas tardes',
  evening: 'Buenas noches',
  hello: 'Hola'
};

const fr: Messages = {
  heroTitle: 'Ather — Votre OS social',
  heroSub: 'Une appli, toutes les langues, pour chacun.',
  bharatFirst: 'Bharat d\u2019abord',
  featuresHeading: 'Fonctionnalités avancées pour Bharat',
  chooseLanguage: 'Choisir la langue',
  languagesSupported: 'langues prises en charge',
  madeIn: 'Fabriqué en Inde',
  morning: 'Bonjour',
  afternoon: 'Bon après-midi',
  evening: 'Bonsoir',
  hello: 'Salut'
};

const de: Messages = {
  heroTitle: 'Ather — Dein Social-OS',
  heroSub: 'Eine App, alle Sprachen, für alle.',
  bharatFirst: 'Bharat zuerst',
  featuresHeading: 'Erweiterte Funktionen für Bharat',
  chooseLanguage: 'Sprache wählen',
  languagesSupported: 'Sprachen unterstützt',
  madeIn: 'Made in India',
  morning: 'Guten Morgen',
  afternoon: 'Guten Tag',
  evening: 'Guten Abend',
  hello: 'Hallo'
};

const pt: Messages = {
  heroTitle: 'Ather — Seu sistema social',
  heroSub: 'Um app, todas as línguas, para todos.',
  bharatFirst: 'Bharat primeiro',
  chooseLanguage: 'Escolha o idioma',
  languagesSupported: 'idiomas suportados',
  madeIn: 'Feito na Índia',
  morning: 'Bom dia',
  afternoon: 'Boa tarde',
  evening: 'Boa noite',
  hello: 'Olá'
};

const ru: Messages = {
  heroTitle: 'Ather — Ваш социальный OS',
  heroSub: 'Одно приложение, все языки, для каждого.',
  bharatFirst: 'Бхарат прежде всего',
  chooseLanguage: 'Выберите язык',
  languagesSupported: 'языков поддерживается',
  madeIn: 'Сделано в Индии',
  morning: 'Доброе утро',
  afternoon: 'Добрый день',
  evening: 'Добрый вечер',
  hello: 'Здравствуйте'
};

const ar: Messages = {
  heroTitle: 'Ather — نظام التواصل الخاص بك',
  heroSub: 'تطبيق واحد، كل اللغات، لكل شخص.',
  bharatFirst: 'بهارات أولاً',
  chooseLanguage: 'اختر اللغة',
  languagesSupported: 'لغة مدعومة',
  madeIn: 'صُنع في الهند',
  morning: 'صباح الخير',
  afternoon: 'مساء الخير',
  evening: 'مساء الخير',
  hello: 'مرحبا'
};

const zh: Messages = {
  heroTitle: 'Ather — 你的社交操作系统',
  heroSub: '一个应用，所有语言，服务每个人。',
  bharatFirst: '印度优先',
  chooseLanguage: '选择语言',
  languagesSupported: '种语言支持',
  madeIn: '印度制造',
  morning: '早上好',
  afternoon: '下午好',
  evening: '晚上好',
  hello: '你好'
};

const ja: Messages = {
  heroTitle: 'Ather — あなたのソーシャルOS',
  heroSub: '一つのアプリ、すべての言語、すべての人へ。',
  bharatFirst: 'バーラト優先',
  chooseLanguage: '言語を選択',
  languagesSupported: '言語対応',
  madeIn: 'インド製',
  morning: 'おはようございます',
  afternoon: 'こんにちは',
  evening: 'こんばんは',
  hello: 'こんにちは'
};

export const MESSAGES: Readonly<Record<LocaleCode, Messages>> = Object.freeze({
  en,
  es,
  fr,
  de,
  pt,
  ru,
  ar,
  zh,
  ja,
  as,
  bn,
  brx,
  doi,
  gu,
  hi,
  kn,
  ks,
  gom,
  mai,
  ml,
  mni,
  mr,
  ne,
  or,
  pa,
  sa,
  sat,
  sd,
  ta,
  te,
  ur
});

export const ENGLISH_MESSAGES: Required<Messages> = en;
