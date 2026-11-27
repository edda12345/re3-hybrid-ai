# Re3 Hybrid AI

**Privacy-First On-Device Eco-Triage & Cloud Drop-Off Planner** built with **Firebase AI Logic Hybrid Inference** (`firebase/ai`), **Chrome Gemini Nano**, **Firebase App Check**, and **Cloud Firestore**.

## Value Proposition
Household recycling breaks down when users are unsure how to sort or prepare specific items—especially in low-connectivity environments or when they prefer instant, private assistance without sending everyday household queries to external servers. **Re3 Hybrid AI** solves this using a dual-tier hybrid inference architecture:
- **On-Device First (`InferenceMode.PREFER_ON_DEVICE`):** Instant, offline-capable item classification and preparation instructions powered locally by **Gemini Nano** in Chrome, automatically falling back to **Gemini 2.5 Flash** in the cloud on browsers without local model support.
- **Cloud Escalation (`InferenceMode.ONLY_CLOUD`):** Synthesizes multi-item sorted batches into an actionable drop-off packing checklist and environmental diversion summary via **Gemini 2.5 Flash**, syncing manifests to **Cloud Firestore**.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Lucide Icons
- **AI & Backend:** Firebase AI Logic SDK (`firebase/ai`), Chrome Built-in AI (Gemini Nano), Firebase App Check, Cloud Firestore

## Setup & Running Locally
1. Clone this repository and install dependencies:
   ```bash
   npm install