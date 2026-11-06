import type { ChatbotSignature, WebsiteAnalysis } from "@/types";

const CHATBOT_SIGNATURES: ChatbotSignature[] = [
  { vendor: "Tidio", patterns: [/code\.tidio\.co/i, /tidioChatApi/i] },
  { vendor: "Intercom", patterns: [/widget\.intercom\.io/i, /Intercom\(/i] },
  { vendor: "Crisp", patterns: [/client\.crisp\.chat/i, /CRISP_WEBSITE_ID/i] },
  { vendor: "Tawk.to", patterns: [/embed\.tawk\.to/i, /Tawk_API/i] },
  { vendor: "Zendesk", patterns: [/static\.zdassets\.com/i, /zE\(/i] },
  { vendor: "HubSpot", patterns: [/js\.hs-scripts\.com/i, /HubSpotConversations/i] },
  { vendor: "Drift", patterns: [/js\.driftt\.com/i, /drift\.load/i] },
  { vendor: "LiveChat", patterns: [/cdn\.livechatinc\.com/i, /__lc/i] },
  { vendor: "Smartsupp", patterns: [/smartsuppchat\.com/i, /_smartsupp/i] },
  { vendor: "Botpress", patterns: [/cdn\.botpress\.cloud/i, /botpressWebChat/i] },
  { vendor: "Voiceflow", patterns: [/cdn\.voiceflow\.com/i, /voiceflow\.chat/i] },
  { vendor: "Landbot", patterns: [/static\.landbot\.io/i, /Landbot/i] },
  { vendor: "ManyChat", patterns: [/manychat\.com/i, /mcwidget/i] },
  { vendor: "Iubenda / Custom AI", patterns: [/chatbase\.co/i, /customgpt/i] },
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORED_EMAIL_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|css|js)$/i;
const IGNORED_EMAIL_DOMAINS = /(sentry\.io|example\.com|wixpress\.com|yourdomain\.com)/i;

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { email: null, hasChatbot: null, chatbotVendor: null };
    }

    const html = await response.text();

    //  Ricerca Email (prima da mailto:, poi regex nel testo)
    let email: string | null = null;
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch?.[1]) {
      email = mailtoMatch[1].toLowerCase();
    } else {
      const matches = html.match(EMAIL_REGEX) ?? [];
      const validEmail = matches.find(
        (e) => !IGNORED_EMAIL_EXTENSIONS.test(e) && !IGNORED_EMAIL_DOMAINS.test(e)
      );
      if (validEmail) {
        email = validEmail.toLowerCase();
      }
    }

    //  Rilevamento Chatbot
    let chatbotVendor: string | null = null;
    for (const signature of CHATBOT_SIGNATURES) {
      if (signature.patterns.some((pattern) => pattern.test(html))) {
        chatbotVendor = signature.vendor;
        break;
      }
    }

    return {
      email,
      hasChatbot: Boolean(chatbotVendor),
      chatbotVendor,
    };
  } catch {
    // Se il sito non risponde o va in timeout, lasciamo hasChatbot a null ("non analizzato")
    return {
      email: null,
      hasChatbot: null,
      chatbotVendor: null,
    };
  }
}
