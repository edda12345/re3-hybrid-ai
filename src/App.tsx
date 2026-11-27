import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  ArrowUpRight,
  Wifi,
  WifiOff,
  CheckCircle2,
  Circle,
  RotateCcw,
  Sparkles,
  PackageCheck,
  Cpu,
  Cloud,
  Timer,
  Info,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { hybridTriageModel, cloudPlannerModel, db } from "./firebase";
import {
  RecycleModel3D,
  inferRecycleKind3D,
  type RecycleKind3D,
} from "./RecycleModel3D";

interface ParsedTriage {
  action: "Reduce" | "Reuse" | "Recycle" | "Dispose Safely";
  material: string;
  steps: string[];
  tip: string;
}

interface TriageEntry {
  id: string;
  query: string;
  kind: RecycleKind3D;
  status: "sorting" | "ready";
  startedAtMs: number;
  parsed?: ParsedTriage;
  sourceLabel?: "On-Device" | "Cloud" | "Local Fallback";
  latencySec?: string;
  fallbackNotice?: string;
  prepped: boolean;
  tiltDeg: number;
}

const CHUTE_SAMPLES: Array<{ label: string; query: string; kind: RecycleKind3D }> = [
  { label: "Pizza box", query: "Greasy pizza box with clean lid", kind: "box" },
  { label: "Shampoo bottle", query: "Empty shampoo bottle with pump", kind: "bottle" },
  { label: "Phone battery", query: "Old swollen phone battery", kind: "battery" },
  { label: "Glass jam jar", query: "Glass jam jar with metal lid", kind: "jar" },
];

const HOW_IT_WORKS_STEPS = [
  {
    num: "01",
    title: "Check Before Tossing",
    desc: "Type what you're holding or tap a 3D item at the bin kiosk before dropping it in.",
  },
  {
    num: "02",
    title: "Learn & Prep Right",
    desc: "See whether to Reduce, Reuse, Recycle, or Dispose Safely, follow quick prep steps, and mark it prepped.",
  },
  {
    num: "03",
    title: "Station Bin Guide",
    desc: "Generate a bin-by-bin sorting summary for all items you brought to the recycling station.",
  },
];

function buildLocalFallbackTriage(queryText: string, kind: RecycleKind3D): ParsedTriage {
  const lower = queryText.toLowerCase();

  if (
    kind === "battery" ||
    /\bbattery\b|\bswollen\b|\blithium\b|\bhazardous\b|\bchemical\b/.test(lower)
  ) {
    return {
      action: "Dispose Safely",
      material: "Battery / Hazard",
      steps: [
        "Keep dry and do not drop into regular recycling or general waste bins",
        "Place in the dedicated battery or hazardous safety drop bin",
      ],
      tip: "Batteries can spark fires or leak if crushed in standard sorting streams.",
    };
  }

  if (kind === "ewaste") {
    return {
      action: "Dispose Safely",
      material: "E-Waste / Electronics",
      steps: [
        "Remove personal data or unpair devices where possible",
        "Drop off at an authorized e-waste collection point",
      ],
      tip: "Electronics contain recoverable metals and components that need safe e-waste handling.",
    };
  }

  if (/\bmagazine\b|\bnewspaper\b|\bflyer\b|\bbrochure\b|\bpaper\b/.test(lower)) {
    return {
      action: "Recycle",
      material: "Paper & Print",
      steps: [
        "Keep dry and remove any plastic wrap or non-paper inserts",
        "Place flat into the Paper / Cardboard recycling bin",
      ],
      tip: "Dry, unsoiled magazines and newspapers pulp cleanly in the paper stream.",
    };
  }

  if (/\bbook\b|\bnotebook\b/.test(lower)) {
    return {
      action: "Reuse",
      material: "Books & Notebooks",
      steps: [
        "Place readable books on a campus/community swap shelf or donate",
        "Remove plastic/spiral bindings before recycling loose dry pages",
      ],
      tip: "Books stay in circulation longest when shared or donated before pulping.",
    };
  }

  if (kind === "clothing") {
    return {
      action: "Reuse",
      material: "Textiles / Apparel",
      steps: [
        "Place clean wearable clothes or shoes in a textile donation/swap bin",
        "Repurpose worn fabric into cleaning cloths if no longer wearable",
      ],
      tip: "Clean textiles shouldn't go into standard paper or plastic recycling bins.",
    };
  }

  if (/\bgreasy\b|\boily\b|\bsoiled\b|\bstained\b/.test(lower) && kind === "box") {
    return {
      action: "Reuse",
      material: "Food-Soiled Cardboard",
      steps: [
        "Tear off clean dry lid/sections for the Paper / Cardboard bin",
        "Keep greasy base out of paper recycling—compost or dispose separately",
      ],
      tip: "Food oil ruins paper fiber batches—always separate clean cardboard from greasy parts.",
    };
  }

  if (kind === "bag" || /\bsingle-use\b|\bdisposable\b|\bstraw\b|\bcup\b|\bwrapper\b/.test(lower)) {
    return {
      action: "Reduce",
      material: "Bags / Single-Use Packaging",
      steps: [
        "Reuse sturdy bags or switch to a reusable carrier on future trips",
        "Check local station signage before discarding wrappers or thin film",
      ],
      tip: "Cutting single-use bags and wrappers at the source prevents bin jams and contamination.",
    };
  }

  if (kind === "can") {
    return {
      action: "Recycle",
      material: "Metal Can",
      steps: [
        "Empty and rinse out food or drink residue",
        "Drop into the Metal / Cans recycling bin",
      ],
      tip: "Clean metal cans are infinitely recyclable without losing quality.",
    };
  }

  if (kind === "jar") {
    return {
      action: "Recycle",
      material: "Glass Container",
      steps: [
        "Rinse out food residue and empty liquids",
        "Separate metal lid and place in the Glass bin",
      ],
      tip: "Rinsing glass jars prevents odors and contamination at collection stations.",
    };
  }

  if (kind === "box" || kind === "paper") {
    return {
      action: "Recycle",
      material: "Cardboard / Paper",
      steps: [
        "Flatten box or bundle dry paper neatly",
        "Keep dry and place in the Paper / Cardboard bin",
      ],
      tip: "Flattening boxes saves up to 70% of bin space at school and community stations.",
    };
  }

  if (kind === "bottle") {
    return {
      action: "Recycle",
      material: "Plastic Container",
      steps: [
        "Empty and rinse out leftover liquid or product",
        "Drain dry and drop into the Plastics recycling bin",
      ],
      tip: "One unemptied bottle can contaminate a whole bag of clean recyclables.",
    };
  }

  return {
    action: "Reuse",
    material: "General Household Item",
    steps: [
      "Check if the item can be repaired, shared, or repurposed first",
      "Follow local station bin signage if discarding",
    ],
    tip: "Checking material and condition before binning keeps station streams clean.",
  };
}

function parseTriageResponse(
  rawText: string,
  fallbackQuery: string,
  kind: RecycleKind3D
): ParsedTriage {
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      const validActions = ["Reduce", "Reuse", "Recycle", "Dispose Safely"] as const;
      const action = validActions.includes(obj.action)
        ? obj.action
        : buildLocalFallbackTriage(fallbackQuery, kind).action;
      const steps = Array.isArray(obj.steps)
        ? obj.steps
            .map((s: unknown) => String(s).replace(/^[-*•\d.)]+\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 2)
        : [];
      return {
        action,
        material:
          typeof obj.material === "string" && obj.material.trim()
            ? obj.material.trim()
            : buildLocalFallbackTriage(fallbackQuery, kind).material,
        steps:
          steps.length > 0
            ? steps
            : buildLocalFallbackTriage(fallbackQuery, kind).steps,
        tip:
          typeof obj.tip === "string" && obj.tip.trim()
            ? obj.tip.trim()
            : buildLocalFallbackTriage(fallbackQuery, kind).tip,
      };
    }
  } catch {
    // Fallback if plain text is returned
  }

  let detectedAction: ParsedTriage["action"] = buildLocalFallbackTriage(fallbackQuery, kind).action;
  if (/\breduce\b/i.test(cleaned)) detectedAction = "Reduce";
  else if (/\breuse\b/i.test(cleaned)) detectedAction = "Reuse";
  else if (/\bdispose\b|\bbattery\b|\bhazardous\b|\bswollen\b/i.test(cleaned)) {
    detectedAction = "Dispose Safely";
  } else if (/\brecycle\b/i.test(cleaned)) {
    detectedAction = "Recycle";
  }

  const meaningfulLines = cleaned
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").trim())
    .filter(
      (l) =>
        l.length > 8 &&
        !/^(action|category|material|steps|prep|tip|why|here'?s why):?$/i.test(l) &&
        !/^(reduce|reuse|recycle|dispose safely):?$/i.test(l)
    );

  const fallback = buildLocalFallbackTriage(fallbackQuery, kind);
  return {
    action: detectedAction,
    material: fallback.material,
    steps: meaningfulLines.slice(0, 2).length > 0 ? meaningfulLines.slice(0, 2) : fallback.steps,
    tip: meaningfulLines[2] || fallback.tip,
  };
}

function buildLocalFallbackManifest(items: TriageEntry[]): string {
  const readyItems = items.filter((i) => i.status === "ready" && i.parsed);
  const byAction = readyItems.reduce<Record<string, TriageEntry[]>>((acc, item) => {
    const key = item.parsed!.action;
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {});

  const lines: string[] = ["Station Bin-by-Bin Guide:"];
  Object.entries(byAction).forEach(([action, group]) => {
    lines.push(`\n• ${action} (${group.length}):`);
    group.forEach((g) => {
      lines.push(`  - ${g.query}: ${g.parsed!.steps[0] || "Prep before placing in station bin"}`);
    });
  });
  lines.push("\n• Station Rule: Keep wet, greasy, or battery items out of dry recycling bins.");
  return lines.join("\n");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${(ms / 1000).toFixed(0)}s.`));
    }, ms);

    promise
      .then((val) => {
        window.clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

const LOOP_BADGE: Record<
  ParsedTriage["action"],
  { bg: string; text: string; ring: string; tag: string }
> = {
  Reduce: { bg: "#dcfce7", text: "#14532d", ring: "#4ade80", tag: "SKIP SINGLE-USE" },
  Reuse: { bg: "#fef08a", text: "#713f12", ring: "#facc15", tag: "KEEP IN LOOP" },
  Recycle: { bg: "#a7f3d0", text: "#064e3b", ring: "#10b981", tag: "CLEAN & SORT" },
  "Dispose Safely": { bg: "#fecaca", text: "#7f1d1d", ring: "#f87171", tag: "SPECIAL DROP" },
};

export default function App() {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<RecycleKind3D>("bottle");
  const [justDropped, setJustDropped] = useState(false);

  const [nowMs, setNowMs] = useState(() => performance.now());

  const [planning, setPlanning] = useState(false);
  const [planStatus, setPlanStatus] = useState("");
  const [planElapsedSec, setPlanElapsedSec] = useState(0);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [nanoAvailable, setNanoAvailable] = useState(false);
  const [entries, setEntries] = useState<TriageEntry[]>([]);
  const [manifest, setManifest] = useState("");
  const [synced, setSynced] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const planTimerRef = useRef<number | null>(null);

  const anySorting = entries.some((e) => e.status === "sorting");

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    (async () => {
      try {
        const lm = (
          window as unknown as { LanguageModel?: { availability: () => Promise<string> } }
        ).LanguageModel;
        if (lm?.availability) {
          const status = await lm.availability();
          setNanoAvailable(status === "available");
        }
      } catch {
        setNanoAvailable(false);
      }
    })();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (planTimerRef.current) window.clearInterval(planTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!anySorting) return;
    const id = window.setInterval(() => {
      setNowMs(performance.now());
    }, 100);
    return () => window.clearInterval(id);
  }, [anySorting]);

  const startPlanTimer = () => {
    if (planTimerRef.current) window.clearInterval(planTimerRef.current);
    const start = performance.now();
    setPlanElapsedSec(0);
    planTimerRef.current = window.setInterval(() => {
      setPlanElapsedSec(Number(((performance.now() - start) / 1000).toFixed(1)));
    }, 100);
  };

  const stopPlanTimer = () => {
    if (planTimerRef.current) {
      window.clearInterval(planTimerRef.current);
      planTimerRef.current = null;
    }
  };

  const handleSort = async (itemText?: string, forcedKind?: RecycleKind3D) => {
    const target = (itemText ?? query).trim();
    if (!target) return;

    const id = crypto.randomUUID();
    const kind = forcedKind ?? inferRecycleKind3D(target);
    const startedAtMs = performance.now();
    const tilts = [-1.8, 1.8, -1.2, 2.0];
    const tiltDeg = tilts[entries.length % tilts.length];

    setActiveKind(kind);
    setJustDropped(true);
    setErrorMsg("");
    setNowMs(startedAtMs);
    setTimeout(() => setJustDropped(false), 750);

    const placeholderEntry: TriageEntry = {
      id,
      query: target,
      kind,
      status: "sorting",
      startedAtMs,
      prepped: false,
      tiltDeg,
    };

    setEntries((prev) => [placeholderEntry, ...prev]);
    if (!itemText) setQuery("");

    try {
      const res = await withTimeout(
        hybridTriageModel.generateContent(
          `Classify this item at a recycling station kiosk for Reduce, Reuse, Recycle, or Dispose Safely: "${target}"`
        ),
        12000,
        "Sorting"
      );
      const elapsedSec = ((performance.now() - startedAtMs) / 1000).toFixed(1);
      const parsed = parseTriageResponse(res.response.text(), target, kind);

      const sourceLabel: "On-Device" | "Cloud" =
        !navigator.onLine || (nanoAvailable && Number(elapsedSec) < 2.2) ? "On-Device" : "Cloud";

      setEntries((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "ready",
                parsed,
                sourceLabel,
                latencySec: `${elapsedSec}s`,
              }
            : item
        )
      );
    } catch (err: unknown) {
      const elapsedSec = ((performance.now() - startedAtMs) / 1000).toFixed(1);
      const reason = err instanceof Error ? err.message : "Model unavailable";
      const fallbackParsed = buildLocalFallbackTriage(target, kind);
      const notice = `AI slow/unavailable (${reason})—sorted with local kiosk rules.`;

      setErrorMsg(notice);
      setEntries((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "ready",
                parsed: fallbackParsed,
                sourceLabel: "Local Fallback",
                latencySec: `${elapsedSec}s`,
                fallbackNotice: notice,
              }
            : item
        )
      );
    }
  };

  const togglePrepped = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, prepped: !e.prepped } : e))
    );
  };

  const handleCreateManifest = async () => {
    const readyEntries = entries.filter((e) => e.status === "ready" && e.parsed);
    if (readyEntries.length === 0 || planning) return;

    setPlanning(true);
    setPlanStatus("Building station bin guide...");
    setErrorMsg("");
    setSynced(false);
    startPlanTimer();

    try {
      const listSummary = readyEntries
        .map(
          (e, idx) =>
            `${idx + 1}. ${e.query} [${e.parsed!.action} - ${e.parsed!.material}] (${
              e.prepped ? "Prepped" : "Needs prep"
            }): ${e.parsed!.steps.join(", ")}`
        )
        .join("\n");

      const res = await withTimeout(
        cloudPlannerModel.generateContent(
          `Build a clear bin-by-bin recycling station sorting guide for:\n${listSummary}`
        ),
        15000,
        "Station guide"
      );
      const cleanText = res.response.text().replace(/\*\*/g, "").trim();
      setManifest(cleanText);

      if (navigator.onLine) {
        setPlanStatus("Saving session log to Firestore...");
        try {
          await withTimeout(
            addDoc(collection(db, "re3_dispatch_manifests"), {
              totalItems: readyEntries.length,
              preppedItems: readyEntries.filter((e) => e.prepped).length,
              items: readyEntries.map((e) => ({
                query: e.query,
                kind: e.kind,
                action: e.parsed!.action,
                material: e.parsed!.material,
                prepped: e.prepped,
              })),
              manifest: cleanText,
              createdAt: serverTimestamp(),
            }),
            8000,
            "Firestore sync"
          );
          setSynced(true);
        } catch {
          // Optional if Firestore rules are locked or slow
        }
      }
    } catch {
      setPlanStatus("Using local station guide...");
      setManifest(buildLocalFallbackManifest(readyEntries));
      setErrorMsg(
        "Cloud guide took too long or was blocked—showing an instant local station guide so users aren't kept waiting at the bin."
      );
    } finally {
      stopPlanTimer();
      setPlanning(false);
      setPlanStatus("");
    }
  };

  const readyEntries = entries.filter((e) => e.status === "ready" && e.parsed);
  const preppedCount = readyEntries.filter((e) => e.prepped).length;
  const loopPercent =
    readyEntries.length === 0 ? 0 : Math.round((preppedCount / readyEntries.length) * 100);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes floatStickerA {
          0%, 100% { transform: translateY(0px) rotate(-5deg); }
          50% { transform: translateY(-6px) rotate(-2deg); }
        }
        @keyframes floatStickerB {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50% { transform: translateY(-7px) rotate(3deg); }
        }
        @keyframes chuteDrop {
          0% { transform: translateY(-10px) scale(0.95); }
          50% { transform: translateY(4px) scale(1.02); }
          100% { transform: translateY(0px) scale(1); }
        }
        @keyframes cardPop {
          0% { opacity: 0; transform: translateY(12px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        .re3-spin { animation: spinSlow 14s linear infinite; }
        .re3-sticker-a { animation: floatStickerA 4.2s ease-in-out infinite; }
        .re3-sticker-b { animation: floatStickerB 4.8s ease-in-out infinite; }
        .re3-chute-drop { animation: chuteDrop 0.65s ease; }
        .re3-card-pop { animation: cardPop 0.35s ease forwards; }
      `}</style>

      <div style={styles.container}>
        <header style={styles.topbar}>
          <div style={styles.brandGroup}>
            <div style={styles.loopIconBox}>
              <RefreshCw size={18} color="#a7f3d0" className="re3-spin" />
            </div>
            <div>
              <div style={styles.brandTitle}>Re3 · Bin-Side Education Kiosk</div>
              <div style={styles.brandSub}>For Recycling Centres, Schools & Eco-Stations</div>
            </div>
          </div>

          <div style={styles.pillRow}>
            <span style={styles.pill}>
              {isOnline ? (
                <Wifi size={13} color="#34d399" />
              ) : (
                <WifiOff size={13} color="#f87171" />
              )}
              {isOnline ? "Kiosk Online" : "Offline Mode"}
            </span>
            <span style={styles.pill}>
              <Cpu size={13} color="#6ee7b7" />
              {nanoAvailable ? "On-Device Nano" : "Hybrid AI"}
            </span>
          </div>
        </header>

        <section style={styles.introBanner}>
          <div style={styles.introTopRow}>
            <div style={styles.introBadgeRow}>
              <div style={styles.introBadge}>
                <Info size={13} />
                <span>BIN-SIDE KIOSK · HOW IT WORKS</span>
              </div>
              <span style={styles.hashtagTag}>#BuildHybridAI</span>
            </div>
            <div style={styles.creatorMeta}>
              Built by <strong>Edda Sarong Chaong</strong> · Designed for recycling centres,
              schools & organizations to educate people right before they toss
            </div>
          </div>

          <div style={styles.stepsGrid}>
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.num} style={styles.stepCard}>
                <span style={styles.stepNum}>{step.num}</span>
                <div>
                  <div style={styles.stepTitle}>{step.title}</div>
                  <div style={styles.stepDesc}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.heroCard}>
          <div style={{ ...styles.sticker, ...styles.stickerTopRight }} className="re3-sticker-a">
            BIN KIOSK MODE
          </div>
          <div style={{ ...styles.sticker, ...styles.stickerBottomRight }} className="re3-sticker-b">
            STOP CONTAMINATION
          </div>

          <div style={styles.heroGrid}>
            <div style={styles.heroLeft}>
              <div style={styles.kicker}>
                <RefreshCw size={13} className="re3-spin" />
                <span>SMART RECYCLING STATION KIOSK</span>
              </div>
              <h1 style={styles.headline}>
                Before you toss it—
                <br />
                <span style={styles.headlineAccent}>check the right bin.</span>
              </h1>
              <p style={styles.lead}>
                Standing at a school, office, or recycling centre bin? Type what you’re holding
                to learn whether to <strong>Reduce</strong>, <strong>Reuse</strong>,{" "}
                <strong>Recycle</strong>, or <strong>Dispose Safely</strong>.
              </p>

              <div
                style={styles.chuteBox}
                className={justDropped ? "re3-chute-drop" : undefined}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setActiveKind(inferRecycleKind3D(e.target.value));
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSort()}
                  placeholder="Type what you're holding: e.g., jeans, soda can, old charger..."
                  style={styles.chuteInput}
                />
                <button
                  onClick={() => handleSort()}
                  disabled={!query.trim()}
                  style={{
                    ...styles.chuteBtn,
                    opacity: !query.trim() ? 0.55 : 1,
                  }}
                >
                  <span>Check Item</span>
                  <ArrowUpRight size={17} />
                </button>
              </div>

              <div style={styles.sampleWrap}>
                <span style={styles.samplePrefix}>Common bin items:</span>
                {CHUTE_SAMPLES.map((sample) => (
                  <button
                    key={sample.label}
                    onClick={() => handleSort(sample.query, sample.kind)}
                    style={styles.sampleStickerBtn}
                  >
                    <RecycleModel3D kind={sample.kind} size={34} interactive={false} />
                    <span>{sample.label}</span>
                  </button>
                ))}
              </div>

              {errorMsg && <div style={styles.errBox}>{errorMsg}</div>}
            </div>

            <aside style={styles.orbitCard}>
              <div style={styles.stageRow}>
                <RecycleModel3D kind={activeKind} size={96} interactive={true} />
                <div style={styles.stageMeta}>
                  <div style={styles.meterLabel}>3D ITEM PREVIEW</div>
                  <div style={styles.orbitPct}>{loopPercent}%</div>
                  <div style={styles.orbitSub}>
                    {preppedCount}/{readyEntries.length} READY FOR BIN
                  </div>
                </div>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${loopPercent}%`,
                  }}
                />
              </div>

              <div style={styles.tagStrip}>
                <span style={styles.miniStickerGreen}>REDUCE</span>
                <span style={styles.miniStickerAmber}>REUSE</span>
                <span style={styles.miniStickerTeal}>RECYCLE</span>
              </div>
            </aside>
          </div>
        </section>

        <section style={styles.lowerGrid}>
          <div style={styles.binCard}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Checked Items ({entries.length})</h2>
                <p style={styles.cardSub}>Follow the prep tips, then click “Mark Prepped” before binning.</p>
              </div>
              {entries.length > 0 && (
                <button
                  onClick={() => {
                    setEntries([]);
                    setManifest("");
                  }}
                  style={styles.resetBtn}
                >
                  <RotateCcw size={13} /> Clear
                </button>
              )}
            </div>

            {entries.length === 0 ? (
              <div style={styles.emptyState}>
                No items checked yet—tap a common bin item above or type what you’re holding to
                see which bin it belongs in.
              </div>
            ) : (
              <div style={styles.itemList}>
                {entries.map((entry) => {
                  const elapsedLive = Math.max(
                    0,
                    Number(((nowMs - entry.startedAtMs) / 1000).toFixed(1))
                  ).toFixed(1);

                  if (entry.status === "sorting") {
                    return (
                      <article
                        key={entry.id}
                        className="re3-card-pop"
                        style={{
                          ...styles.entryCard,
                          borderColor: "#6ee7b7",
                          backgroundColor: "#f8fffb",
                        }}
                      >
                        <div style={styles.entryTop}>
                          <div style={styles.entryTitleRow}>
                            <RecycleModel3D kind={entry.kind} size={44} interactive={false} />
                            <div>
                              <h3 style={styles.entryName}>{entry.query}</h3>
                              <span style={styles.entryMaterial}>Checking bin rules...</span>
                            </div>
                          </div>
                          <span style={styles.sortingPill}>
                            <Timer size={12} /> {elapsedLive}s
                          </span>
                        </div>
                        <div style={styles.sortingProgressText}>
                          Identifying material & right bin ({elapsedLive}s elapsed)...
                        </div>
                      </article>
                    );
                  }

                  const badge = LOOP_BADGE[entry.parsed!.action];
                  return (
                    <article
                      key={entry.id}
                      className="re3-card-pop"
                      style={{
                        ...styles.entryCard,
                        transform: `rotate(${entry.prepped ? 0 : entry.tiltDeg}deg)`,
                        borderColor: entry.prepped ? "#34d399" : "#cbd5cf",
                      }}
                    >
                      <div style={styles.entryTop}>
                        <div style={styles.entryTitleRow}>
                          <RecycleModel3D kind={entry.kind} size={44} interactive={true} />
                          <div>
                            <h3 style={styles.entryName}>{entry.query}</h3>
                            <span style={styles.entryMaterial}>{entry.parsed!.material}</span>
                          </div>
                        </div>
                        <div style={styles.badgeCol}>
                          <span
                            aria-label={`Recommended action: ${entry.parsed!.action}`}
                            style={{
                              ...styles.loopTag,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.ring,
                            }}
                          >
                            {entry.parsed!.action}
                          </span>
                          <span style={styles.itemStamp}>{badge.tag}</span>
                        </div>
                      </div>

                      <ul style={styles.prepUl}>
                        {entry.parsed!.steps.map((s, i) => (
                          <li key={i} style={styles.prepLi}>
                            {s}
                          </li>
                        ))}
                      </ul>

                      <div style={styles.ecoNote}>{entry.parsed!.tip}</div>

                      {entry.fallbackNotice && (
                        <div style={styles.fallbackPill}>{entry.fallbackNotice}</div>
                      )}

                      <div style={styles.entryBottom}>
                        <button
                          onClick={() => togglePrepped(entry.id)}
                          style={{
                            ...styles.prepToggle,
                            backgroundColor: entry.prepped ? "#064e3b" : "#eef3f0",
                            color: entry.prepped ? "#ecfdf5" : "#1f2937",
                          }}
                        >
                          {entry.prepped ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Circle size={14} />
                          )}
                          {entry.prepped ? "Prepped!" : "Mark Prepped"}
                        </button>

                        <span style={styles.sourceBadge}>
                          {entry.sourceLabel === "On-Device" ? (
                            <Cpu size={12} />
                          ) : (
                            <Cloud size={12} />
                          )}
                          {entry.sourceLabel} · {entry.latencySec}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.binCard}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Station Bin Guide</h2>
                <p style={styles.cardSub}>Group your checked items by which station bin to use.</p>
              </div>
              <button
                onClick={handleCreateManifest}
                disabled={readyEntries.length === 0 || planning || !isOnline}
                style={{
                  ...styles.dispatchBtn,
                  opacity: readyEntries.length === 0 || planning || !isOnline ? 0.5 : 1,
                }}
              >
                <Sparkles size={15} />
                {planning ? `${planElapsedSec.toFixed(1)}s` : "Build Guide"}
              </button>
            </div>

            {planning && (
              <div style={styles.dispatchProgressBox}>
                <div style={styles.dispatchProgressRow}>
                  <span>{planStatus || "Building station bin guide..."}</span>
                  <strong>{planElapsedSec.toFixed(1)}s</strong>
                </div>
                <div style={styles.dispatchSubNote}>
                  Auto-falls back to an instant local guide if cloud response takes over 15s.
                </div>
              </div>
            )}

            {!isOnline && (
              <div style={styles.offlineBanner}>
                Offline kiosk mode — items still sort locally using built-in recycling rules.
              </div>
            )}

            {manifest ? (
              <div style={styles.manifestBox}>
                {synced && (
                  <div style={styles.syncedPill}>
                    <PackageCheck size={14} /> Logged to Station Database
                  </div>
                )}
                <div style={styles.manifestText}>{manifest}</div>
              </div>
            ) : (
              <div style={styles.emptyState}>
                Check your items on the left first, then click <strong>Build Guide</strong> to
                see a tidy bin-by-bin summary for the station.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#071813",
    backgroundImage:
      "radial-gradient(circle at 12% 12%, rgba(16, 185, 129, 0.16), transparent 45%), radial-gradient(circle at 88% 18%, rgba(250, 204, 21, 0.09), transparent 42%)",
    color: "#111827",
    padding: "20px 16px 48px",
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: "1140px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  topbar: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  loopIconBox: {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    border: "1.5px solid rgba(110, 231, 183, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#f0fdf4",
  },
  brandSub: {
    fontSize: "12px",
    color: "#86efac",
  },
  pillRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#d1fae5",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    border: "1px solid rgba(167, 243, 208, 0.2)",
    padding: "6px 12px",
    borderRadius: "999px",
  },
  introBanner: {
    borderRadius: "20px",
    backgroundColor: "rgba(12, 41, 32, 0.85)",
    border: "1.5px solid rgba(110, 231, 183, 0.22)",
    padding: "18px 22px",
    color: "#ecfdf5",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  introTopRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  introBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  introBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#6ee7b7",
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    border: "1px solid rgba(110, 231, 183, 0.3)",
    padding: "5px 10px",
    borderRadius: "999px",
  },
  hashtagTag: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: "#713f12",
    backgroundColor: "#fef08a",
    padding: "5px 10px",
    borderRadius: "999px",
  },
  creatorMeta: {
    fontSize: "12.5px",
    color: "#d1fae5",
  },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  stepCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: "rgba(6, 24, 18, 0.65)",
    border: "1px solid rgba(167, 243, 208, 0.16)",
    borderRadius: "14px",
    padding: "12px",
  },
  stepNum: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#064e3b",
    backgroundColor: "#a7f3d0",
    padding: "3px 8px",
    borderRadius: "8px",
    lineHeight: 1.3,
    flexShrink: 0,
  },
  stepTitle: {
    fontSize: "13.5px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "2px",
  },
  stepDesc: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#b7e4cf",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #0c2920 0%, #10382b 58%, #091f18 100%)",
    border: "1.5px solid rgba(110, 231, 183, 0.22)",
    padding: "32px",
    color: "#f8fafc",
  },
  sticker: {
    position: "absolute",
    zIndex: 2,
    fontSize: "10.5px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "6px 12px",
    borderRadius: "999px",
    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.28)",
    pointerEvents: "none",
  },
  stickerTopRight: {
    top: "16px",
    right: "20px",
    backgroundColor: "#fef08a",
    color: "#713f12",
    border: "2px solid #ffffff",
  },
  stickerBottomRight: {
    bottom: "14px",
    right: "20px",
    backgroundColor: "#a7f3d0",
    color: "#064e3b",
    border: "2px solid #ffffff",
  },
  heroGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "28px",
    alignItems: "center",
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
  },
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "11.5px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#6ee7b7",
    marginBottom: "12px",
  },
  headline: {
    margin: "0 0 14px",
    fontSize: "clamp(32px, 4.6vw, 48px)",
    lineHeight: 1.08,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#ffffff",
  },
  headlineAccent: {
    color: "#6ee7b7",
  },
  lead: {
    margin: "0 0 22px",
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#d1fae5",
    maxWidth: "560px",
  },
  chuteBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#f8faf7",
    padding: "6px 6px 6px 16px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
  },
  chuteInput: {
    flex: 1,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    fontSize: "14.5px",
    color: "#0f172a",
    minWidth: "150px",
  },
  chuteBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#065f46",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  sampleWrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginTop: "14px",
  },
  samplePrefix: {
    fontSize: "12px",
    color: "#a7f3d0",
  },
  sampleStickerBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#ecfdf5",
    border: "1px solid rgba(167, 243, 208, 0.28)",
    borderRadius: "14px",
    padding: "4px 11px 4px 6px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  errBox: {
    marginTop: "12px",
    padding: "10px 14px",
    borderRadius: "12px",
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    border: "1px solid rgba(252, 211, 77, 0.45)",
    color: "#fef08a",
    fontSize: "12.5px",
    lineHeight: 1.45,
  },
  orbitCard: {
    backgroundColor: "rgba(6, 24, 18, 0.75)",
    border: "1.5px solid rgba(110, 231, 183, 0.25)",
    borderRadius: "22px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  stageRow: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  stageMeta: {
    textAlign: "left",
  },
  meterLabel: {
    fontSize: "10.5px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#6ee7b7",
  },
  orbitPct: {
    fontSize: "34px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.05,
    marginTop: "2px",
  },
  orbitSub: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#a7f3d0",
  },
  progressTrack: {
    height: "8px",
    borderRadius: "999px",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #34d399, #a7f3d0)",
    transition: "width 0.3s ease",
  },
  tagStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  miniStickerGreen: {
    fontSize: "10px",
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "#dcfce7",
    color: "#14532d",
  },
  miniStickerAmber: {
    fontSize: "10px",
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "#fef08a",
    color: "#713f12",
  },
  miniStickerTeal: {
    fontSize: "10px",
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "#a7f3d0",
    color: "#064e3b",
  },
  lowerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "20px",
    alignItems: "start",
  },
  binCard: {
    backgroundColor: "#f6f8f6",
    borderRadius: "22px",
    padding: "22px",
    border: "1.5px solid #d6dfd9",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f241c",
  },
  cardSub: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#52665c",
  },
  resetBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5cf",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 500,
    color: "#334155",
    cursor: "pointer",
  },
  dispatchBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#065f46",
    color: "#ffffff",
    border: "none",
    borderRadius: "999px",
    padding: "9px 15px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dispatchProgressBox: {
    backgroundColor: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "12px",
    padding: "10px 12px",
    marginBottom: "14px",
  },
  dispatchProgressRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12.5px",
    color: "#064e3b",
    fontWeight: 600,
  },
  dispatchSubNote: {
    marginTop: "4px",
    fontSize: "11.5px",
    color: "#047857",
  },
  offlineBanner: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fcd34d",
    color: "#78350f",
    fontSize: "12.5px",
    padding: "10px 12px",
    borderRadius: "12px",
    marginBottom: "14px",
  },
  emptyState: {
    backgroundColor: "#ffffff",
    border: "1.5px dashed #b9c8bf",
    borderRadius: "16px",
    padding: "22px",
    fontSize: "13.5px",
    lineHeight: 1.6,
    color: "#52665c",
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  entryCard: {
    borderRadius: "18px",
    border: "1.5px solid #cbd5cf",
    backgroundColor: "#ffffff",
    padding: "16px",
    boxShadow: "0 6px 16px rgba(15, 36, 28, 0.06)",
    transition: "transform 0.25s ease, border-color 0.2s ease",
  },
  entryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "10px",
  },
  entryTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  entryName: {
    margin: 0,
    fontSize: "15.5px",
    fontWeight: 700,
    color: "#0f241c",
  },
  entryMaterial: {
    fontSize: "12px",
    color: "#52665c",
  },
  sortingPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#065f46",
    backgroundColor: "#d1fae5",
    padding: "4px 10px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
  },
  sortingProgressText: {
    fontSize: "12.5px",
    color: "#047857",
    backgroundColor: "#ecfdf5",
    padding: "8px 12px",
    borderRadius: "10px",
  },
  fallbackPill: {
    fontSize: "11.5px",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: "6px 10px",
    borderRadius: "8px",
    marginBottom: "10px",
  },
  badgeCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    userSelect: "none",
  },
  loopTag: {
    fontSize: "12px",
    fontWeight: 800,
    padding: "4px 11px",
    borderRadius: "999px",
    border: "1.5px solid",
  },
  itemStamp: {
    fontSize: "9.5px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    color: "#065f46",
    backgroundColor: "#ecfdf5",
    padding: "2px 7px",
    borderRadius: "999px",
  },
  prepUl: {
    margin: "0 0 10px",
    paddingLeft: "18px",
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#1e293b",
  },
  prepLi: {
    marginBottom: "3px",
  },
  ecoNote: {
    fontSize: "12.5px",
    color: "#065f46",
    backgroundColor: "#ecfdf5",
    padding: "8px 12px",
    borderRadius: "10px",
    marginBottom: "12px",
  },
  entryBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  prepToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "none",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  sourceBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11.5px",
    color: "#64748b",
  },
  manifestBox: {
    backgroundColor: "#ffffff",
    border: "1.5px solid #d6dfd9",
    borderRadius: "16px",
    padding: "16px",
  },
  syncedPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#065f46",
    backgroundColor: "#ecfdf5",
    padding: "5px 10px",
    borderRadius: "999px",
    marginBottom: "10px",
  },
  manifestText: {
    whiteSpace: "pre-line",
    fontSize: "13.5px",
    lineHeight: 1.65,
    color: "#1e293b",
  },
};
