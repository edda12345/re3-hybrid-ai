import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDK88F6XdcAxjHET1et4IhJlGJrwgGDSUg",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "re3-hybrid-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "re3-hybrid-ai",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "re3-hybrid-ai.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "550010398351",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:550010398351:web:14bc8d507dd01bd96432fa",
};

const app = initializeApp(firebaseConfig);

let appCheck: AppCheck | null = null;

const envToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN?.trim();
const hasRealEnvToken =
  Boolean(envToken) && envToken !== "paste_your_debug_token_uuid_here";

if (typeof window !== "undefined") {
  (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
    hasRealEnvToken ? envToken : true;

  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
          "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
      ),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("App Check init warning:", err);
  }
}

export { appCheck };
export const db = getFirestore(app);

const ai = getAI(app, { backend: new GoogleAIBackend() });

const TRIAGE_INSTRUCTION = `You are Re3, a practical household sustainability guide focused on Reduce, Reuse, and Recycle.
Respond ONLY in valid JSON (no markdown code fences, no extra text) using this exact shape:
{
  "action": "Reduce" | "Reuse" | "Recycle" | "Dispose Safely",
  "material": "short material tag e.g. HDPE #2 Plastic, Cardboard, E-Waste",
  "steps": ["short step 1 (under 10 words)", "short step 2 (under 10 words)"],
  "tip": "one practical tip under 14 words"
}`;

export const hybridTriageModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  onDeviceParams: {
    model: "gemini-3.8-flash",
    promptOptions: {},
  },
  inCloudParams: {
    model: "gemini-3.8-flash",
    systemInstruction: TRIAGE_INSTRUCTION,
  },
});

export const cloudPlannerModel = getGenerativeModel(ai, {
  model: "gemini-3.8-flash",
  mode: InferenceMode.ONLY_IN_CLOUD,
  inCloudParams: {
    model: "gemini-3.8-flash",
    systemInstruction:
      "You are Re3 Drop-Off Planner. Given a list of sorted household items, write a concise, friendly packing guide with: 1) How to bag/bundle items for drop-off, 2) What to keep separate (like batteries or soiled items), and 3) A realistic note on waste diverted. Keep each bullet under 16 words and avoid heavy jargon.",
  },
});
