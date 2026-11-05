import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CameraOff,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";

/**
 * 😶 Модалкаи Face Authentication (Вуруд бо чеҳра / Сабти чеҳра).
 *
 * Ҳаёти ҷараён:
 *   gate (танҳо сабт: розигӣ + 🔑 ТАСДИКИ ПАРОЛ → ticket) → камера +
 *   моделҳо → скан → ЧОЛИШИ ЛАЙВЛЕС (чашм пузур ×2 / даҳон кушодан —
 *   аз рӯйи landmarkҳо) → 3 нусхаи descriptor → ба сервер (challenge
 *   якдафъаӣ + pw_ticket) → муваффақият/хато.
 *   Бе pw_ticket сервер 428 медиҳад → БАГАРДОНДАН ба дарвозаи парол.
 *
 * Амният:
 *   • Камера танҳо дар secure context (HTTPS) → дар http://IP экрани
 *     возеҳ бо линки HTTPS нишон дода мешавад (getUserMedia кушода намешавад).
 *   • Расм/видео ҲЕҶ ГОҲ ба сервер намефиристад — танҳо vector-и 128-уҷа.
 *   • Розигии возеҳӣ + пароли ҳисоб барои сабт ҲАТМИАН (backend ҳам
 *     маҷбур мекунад: HMAC-ticket, 300s, 403 бе он).
 *   • Агар чеҳра ноком шавад → тугмаи «Бо парол вуруд кунед» ҳамеша ҳаст.
 *
 * Дастгирӣ: role=dialog, aria-modal, ESC, aria-live барои ҳолатҳо,
 * ҳолатҳои Loading / Success / Error, мобил + десктоп (320px санҷида).
 */

type Phase = "gate" | "starting" | "scan" | "capture" | "submit" | "success" | "error";

type Hint = "looking" | "noface" | "multi" | "toofar" | "liveness" | "capturing";

type ErrKind =
  | "insecure"
  | "denied"
  | "nocam"
  | "models"
  | "nomatch"
  | "toomany"
  | "network";

interface Props {
  /** login = вуруд бо чеҳра; enroll = сабт (бо розигӣ) */
  mode: "login" | "enroll";
  onClose: () => void;
  /** Баъди муваффақият (токен гирифта шуд ё чеҳра сабт шуд) */
  onSuccess: () => void;
}

interface Challenge {
  challenge_id: string;
  action: string;
}

type Faceapi = typeof import("@vladmandic/face-api");

interface Pt {
  x: number;
  y: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** EAR — ҳамон чӣ standard: (|p37-p41| + |p38-p40|) / (2·|p36-p39|) */
function earOf(points: Pt[], base: number): number {
  const v1 = dist(points[base + 1], points[base + 5]);
  const v2 = dist(points[base + 2], points[base + 4]);
  const h = dist(points[base], points[base + 3]);
  return h === 0 ? 1 : (v1 + v2) / (2 * h);
}

/** MAR — дохили лаб (60..67): вертикалӣ / уфуқӣ */
function mouthAspect(points: Pt[]): number {
  const v =
    (dist(points[61], points[67]) +
      dist(points[62], points[66]) +
      dist(points[63], points[65])) /
    3;
  const h = dist(points[60], points[64]);
  return h === 0 ? 0 : v / h;
}

function avgDescriptor(samples: number[][]): number[] {
  const out = new Array<number>(128).fill(0);
  for (const s of samples) for (let i = 0; i < 128; i++) out[i] += s[i];
  return out.map((v) => v / samples.length);
}

/** Линки HTTPS барои ин мизоҷ (IP → donatshop.<ip-dashes>.sslip.io) */
export function httpsUrl(): string {
  try {
    const u = new URL(window.location.href);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      u.hostname = `donatshop.${u.hostname.replace(/\./g, "-")}.sslip.io`;
    }
    u.protocol = "https:";
    return u.toString();
  } catch {
    return "https://donatshop.37-27-245-216.sslip.io/";
  }
}

export default function FaceAuthModal({ mode, onClose, onSuccess }: Props) {
  const { t } = useApp();

  const [phase, setPhase] = useState<Phase>(mode === "enroll" ? "gate" : "starting");
  const [hint, setHint] = useState<Hint>("looking");
  const [errKind, setErrKind] = useState<ErrKind>("network");
  const [consent, setConsent] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  // Прогресси «чашм пузур» (0..2) — нуқтаҳо дар карткаи чолиш
  const [blinkProg, setBlinkProg] = useState(0);
  /** recognition net (6.4MB) дар замин: true = тайёр, false = хато */
  const recogRef = useRef<Promise<boolean> | null>(null);
  /** дар роҳи гузариш ба capture (лайвлес гузашт → recognition меборад) */
  const awaitingRef = useRef(false);
  // 🔑 Дарвозаи парол (танҳо сабт)
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const gateBusyRef = useRef(false);
  const ticketRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<Faceapi | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);
  const submittingRef = useRef(false);
  const samplesRef = useRef<number[][]>([]);
  const captureStartRef = useRef(0);
  /** win = медианаи EAR (20 фрейм), deep = фрейми амиқи ягона, bad = фрейми бади пайваста */
  const blinkRef = useRef({ closed: 0, cycles: 0, win: [] as number[], deep: false, bad: 0 });
  const mouthRef = useRef({ open: 0, done: false });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  const consentRef = useRef(consent);
  consentRef.current = consent;
  const successFnRef = useRef(onSuccess);
  successFnRef.current = onSuccess;

  // ========================== 🧹 Тоза кардани камера/таймер ==========================
  const stopAll = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    const st = streamRef.current;
    if (st) {
      st.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      stopAll();
    };
  }, [onClose, stopAll]);

  const resetLiveness = useCallback(() => {
    blinkRef.current = { closed: 0, cycles: 0, win: [], deep: false, bad: 0 };
    mouthRef.current = { open: 0, done: false };
    samplesRef.current = [];
    setBlinkProg(0);
  }, []);

  const fail = useCallback((kind: ErrKind) => {
    setErrKind(kind);
    setPhase("error");
  }, []);

  // ========================== 🎥 Камера + 🧠 Моделҳо + 🎯 Чолиш ==========================
  const begin = useCallback(async () => {
    setPhase("starting");
    resetLiveness();
    setChallenge(null);
    recogRef.current = null;
    awaitingRef.current = false;

    // 🔒 Камера танҳо дар secure context (http://IP → HTTPS лозим)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail("insecure");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      const name = (e as DOMException)?.name;
      fail(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "nocam"
            : "network",
      );
      return;
    }

    try {
      const faceapi = await import("@vladmandic/face-api");
      faceapiRef.current = faceapi;
      // 🔧 tfjs backend: дар ин баста `wasm` (баландтарин тартиб) ибтидо
      //    НАМЕШАВАД → `loadFromUri` ҳангоми сохтани тензор медарояд.
      //    Webgl (суръат) → cpu (ба қатъӣ кор мекунад, дар ҳамаи
      //    браузерҳо). setBackend false бармегардонад → баъдӣ.
      //    (typing-и `tf` танҳо типҳои Tensor дорад → cast-и структурӣ)
      const tf = faceapi.tf as unknown as {
        setBackend(name: string): Promise<boolean>;
        ready(): Promise<void>;
      };
      let be = false;
      try {
        be = await tf.setBackend("webgl");
      } catch {
        be = false;
      }
      if (!be) await tf.setBackend("cpu");
      await tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri("/face-models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/face-models");
      // recognition (6.4MB) ДАР ЗАМИНА → scan дар ~6s сар мешавад.
      // Пештар ҳар чаҳор файл ПЕШ аз scan =60-100s дар шабакаи заъиф →
      // модалка БЕҲАД дар «Камера ва моделҳо тайёр мешаванд» мебандид.
      recogRef.current = faceapi.nets.faceRecognitionNet
        .loadFromUri("/face-models")
        .then(() => true)
        .catch(() => false);
    } catch {
      fail("models");
      return;
    }

    try {
      const ch = await api.faceChallenge();
      setChallenge({ challenge_id: ch.challenge_id, action: ch.action });
    } catch (e) {
      fail(e instanceof ApiError && e.status === 429 ? "toomany" : "network");
      return;
    }

    setPhase("scan");
    setHint("looking");
  }, [fail, resetLiveness]);

  // Оғоз: login = фавран; enroll = баъди дарвозаи парол
  useEffect(() => {
    if (mode === "login") void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ========================== 🔑 ДАРВОЗАИ ПАРОЛ ==========================
  const confirmGate = useCallback(async () => {
    if (gateBusyRef.current || !consent || !pw) return;
    gateBusyRef.current = true;
    setGateBusy(true);
    setPwErr(null);
    try {
      // Тасдики парол → ticket (300s) → танҳо баъди он камера кушода мешавад
      const res = await api.faceConfirmPassword(pw);
      ticketRef.current = res.ticket;
      setPw(""); // парол дар ҳолат мемонад не
      await begin();
    } catch (e) {
      const st = e instanceof ApiError ? e.status : 0;
      setPwErr(
        st === 403
          ? t("facePwWrong")
          : st === 429
            ? t("faceTooMany")
            : t("faceNetworkError"),
      );
    } finally {
      gateBusyRef.current = false;
      setGateBusy(false);
    }
  }, [begin, consent, pw, t]);

  // ========================== 🖼️ Рамкаи overlay ==========================
  const drawOverlay = useCallback(
    (
      dets: {
        detection: { box: { x: number; y: number; width: number; height: number } };
        landmarks: { positions: Pt[] };
      }[],
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const lw = Math.max(3, w / 150);
      for (const det of dets) {
        const { x, y, width, height } = det.detection.box;
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = lw;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, width, height, Math.min(24, width / 6));
        else ctx.rect(x, y, width, height);
        ctx.stroke();
        const pts = det.landmarks.positions;
        ctx.fillStyle = "rgba(56,189,248,0.95)";
        for (let i = 36; i <= 47; i++) {
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, lw * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(16,185,129,0.9)";
        for (let i = 48; i <= 67; i++) {
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, lw * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [],
  );

  // ========================== 📤 Пешниҳод ба сервер ==========================
  const submit = useCallback(
    async (descriptor: number[]) => {
      if (submittingRef.current || !challengeRef.current) return;
      submittingRef.current = true;
      setPhase("submit");
      const ch = challengeRef.current;
      try {
        if (mode === "login") {
          await api.faceLogin(descriptor, ch.challenge_id, ch.action);
        } else {
          await api.faceRegister(
            descriptor,
            ch.challenge_id,
            ch.action,
            consentRef.current,
            ticketRef.current,
          );
        }
        setPhase("success");
        window.setTimeout(() => successFnRef.current(), 1300);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 428) {
          // 🔑 Парол тасдиқ нашуд/вақташ гузашт → БАГАРДОНДАН ба дарвоза
          submittingRef.current = false;
          stopAll();
          resetLiveness();
          ticketRef.current = null;
          setPw("");
          setPwErr(t("facePwExpired"));
          setPhase("gate");
          return;
        }
        if (status === 400) {
          // Чолиш муҳлаташ гузашт/нодуруст → ЧОЛИШИ НАВ, бе нишондодани хато
          submittingRef.current = false;
          try {
            const next = await api.faceChallenge();
            setChallenge({ challenge_id: next.challenge_id, action: next.action });
            resetLiveness();
            setHint("looking");
            setPhase("scan");
          } catch {
            fail("network");
          }
          return;
        }
        fail(
          status === 401
            ? "nomatch"
            : status === 429
              ? "toomany"
              : "network",
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [fail, mode, resetLiveness, stopAll, t],
  );

  /** Гузариш ба capture: recognition (6.4MB) бояд ТАЙЁР бошад → мунтазирӣ.
   *  awaitingRef то ба тахтаи capture расидан true мемонад (баъди он дар
   *  шохаи capture сифр мешавад) → воридшавии дубора ғайриимкон. */
  const enterCapture = useCallback(async () => {
    const ok = (await recogRef.current) ?? false;
    if (phaseRef.current !== "scan") return; // модалка баста/ҳолат иваз шуд
    if (!ok) {
      fail("models");
      return;
    }
    samplesRef.current = [];
    captureStartRef.current = performance.now();
    setHint("capturing");
    setPhase("capture");
  }, [fail]);

  // ========================== 👁️ Цикли детектсия ==========================
  useEffect(() => {
    if (phase !== "scan" && phase !== "capture") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      void (async () => {
        const faceapi = faceapiRef.current;
        const video = videoRef.current;
        const ph = phaseRef.current;
        if (!faceapi || !video || video.readyState < 2) return;
        if (ph !== "scan" && ph !== "capture") return;
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const opts = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          });
          // descriptor танҳо ҳангоми capture — scan сабук → детектсия тезтар
          const task = faceapi.detectAllFaces(video, opts).withFaceLandmarks();
          const all =
            phaseRef.current === "capture" ? await task.withFaceDescriptors() : await task;
          if (phaseRef.current !== "scan" && phaseRef.current !== "capture") return;
          drawOverlay(all);

          const vw = video.videoWidth;

          // ---------- ҲОЛАТИ CAPTURE: ҷамъ кардани нусхаҳо ----------
          if (phaseRef.current === "capture") {
            awaitingRef.current = false;
            if (all.length === 1 && all[0].detection.box.width >= vw * 0.24) {
              const desc = (all[0] as { descriptor?: Float32Array }).descriptor;
              if (desc) samplesRef.current.push(Array.from(desc));
            }
            const elapsed = performance.now() - captureStartRef.current;
            if (samplesRef.current.length >= 3 || elapsed > 1800) {
              if (samplesRef.current.length > 0) {
                void submit(avgDescriptor(samplesRef.current));
              } else {
                resetLiveness();
                setHint("looking");
                setPhase("scan");
              }
            }
            return;
          }

          // ---------- ҲОЛАТИ SCAN ----------
          if (awaitingRef.current) return; // дар роҳи capture (recognition меборад)
          // Фрейми бади ягона (лаҳзаи гузариш/флукер) → САБР: танҳо2 фрейми
          // пайваста ҳолатро иваз мекунад,5 фрейм → нул кардани пешрафт.
          // (Пеш: ҳар фрейми бад = reset → пешрафти чашм ҳамеша сифр мешуд.)
          const badKind =
            all.length === 0 ? "noface" : all.length > 1 ? "multi" : null;
          const tooFar = all.length === 1 && all[0].detection.box.width < vw * 0.24;
          if (badKind || tooFar) {
            blinkRef.current.bad += 1;
            if (blinkRef.current.bad >= 2) {
              setHint(badKind ?? "toofar");
              if (blinkRef.current.bad >= 5) resetLiveness();
            }
            return;
          }
          blinkRef.current.bad = 0;

          const ch = challengeRef.current;
          if (!ch) return;
          setHint("liveness");

          const pts = all[0].landmarks.positions;
          const ear = (earOf(pts, 36) + earOf(pts, 42)) / 2;
          const mar = mouthAspect(pts);

          if (ch.action === "blink") {
            const bl = blinkRef.current;
            // Одаптивӣ: медионаи EAR-и20 фрейми охир → барои чашми танг ва
            // васеъ алоҳида мувофиқ мешавад; сабти тақрибӣ =0.14.
            // (Пеш: сахти ear<=0.19 бо суръати300ms → чашми табиӣ ҲЕҶ ГОҲ
            //  2 фрейми пӯшид намегирифт → лайвлес БЕҲАД мебандад.)
            bl.win.push(ear);
            if (bl.win.length > 20) bl.win.shift();
            const sorted = [...bl.win].sort((a, b) => a - b);
            const med =
              sorted.length >= 5 ? sorted[sorted.length >> 1] : Math.max(ear, 0.2);
            const closedTh = Math.max(0.14, med * 0.78);
            const deepTh = Math.max(0.12, med * 0.6);
            if (ear <= closedTh) {
              bl.closed += 1;
              if (ear <= deepTh) bl.deep = true;
            } else {
              // кушода: ≥2 фрейми пӯшид ИЁ фрейми амиқи ягона = як чашм задан
              if (bl.closed >= 2 || (bl.closed >= 1 && bl.deep)) bl.cycles += 1;
              bl.closed = 0;
              bl.deep = false;
              setBlinkProg(bl.cycles);
            }
            if (bl.cycles >= 2) {
              awaitingRef.current = true;
              setBlinkProg(2);
              setHint("capturing");
              void enterCapture(); // recognition (6.4MB) тайёр шуданашро интизор
              return;
            }
          } else {
            if (mar >= 0.55) mouthRef.current.open += 1;
            else {
              if (mouthRef.current.open >= 2) mouthRef.current.done = true;
              mouthRef.current.open = 0;
            }
            if (mouthRef.current.done) {
              awaitingRef.current = true;
              setHint("capturing");
              void enterCapture(); // recognition (6.4MB) тайёр шуданашро интизор
              return;
            }
          }
        } catch {
          /* лаҳзаи гузариш — нодида */
        } finally {
          busyRef.current = false;
        }
      })();
    }, 100); // 🚀 пеш300ms →100ms: чашми табиӣ (150-250ms) акнун2-3 фрейм мегирад
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [phase, drawOverlay, resetLiveness, submit, enterCapture]);

  // ========================== 🎨 Рамкаи UI ==========================
  const hintKey =
    hint === "noface"
      ? "faceNoFace"
      : hint === "multi"
        ? "faceMulti"
        : hint === "toofar"
          ? "faceTooFar"
          : hint === "capturing"
            ? "faceCapturing"
            : hint === "liveness"
              ? "faceLiveness"
              : "faceLooking";

  const challengeKey = challenge?.action === "mouth" ? "faceMouthPrompt" : "faceBlinkPrompt";

  const errTitle: Record<ErrKind, string> = {
    insecure: "faceInsecure",
    denied: "faceDenied",
    nocam: "faceNoCamera",
    models: "faceModelsError",
    nomatch: "faceNotMatched",
    toomany: "faceTooMany",
    network: "faceNetworkError",
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        data-face-modal=""
        aria-label={mode === "login" ? t("faceModalLoginTitle") : t("faceModalEnrollTitle")}
        className="card w-full max-w-[420px] max-h-[96vh] overflow-y-auto p-4 sm:p-5 outline-none"
      >
        {/* ===== Сарлавҳа ===== */}
        <div className="flex items-start gap-3 mb-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/25">
            <ScanFace size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug">
              {mode === "login" ? t("faceModalLoginTitle") : t("faceModalEnrollTitle")}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {mode === "login" ? t("faceModalLoginSub") : t("faceModalEnrollSub")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("faceClose")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* ===== 1) ДАРВОЗАИ ПАРОЛ (розигӣ + парол — танҳо сабт) ===== */}
        {phase === "gate" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                  aria-label={t("faceConsentLabel")}
                />
                <span className="text-[13px] leading-snug text-slate-700">
                  {t("faceConsentLabel")}
                </span>
              </label>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
              <ShieldCheck size={15} className="mt-px shrink-0 text-emerald-500" aria-hidden />
              {t("faceConsentNote")}
            </p>

            {/* 🔑 ҲАТМИ: тасдики парол пеш аз сабти чеҳра (backend = 428 бе он) */}
            <div>
              <label
                htmlFor="face-pw"
                className="mb-1 block text-[12px] font-semibold text-slate-600"
              >
                {t("facePwLabel")}
              </label>
              <input
                id="face-pw"
                type="password"
                value={pw}
                autoComplete="current-password"
                onChange={(e) => {
                  setPw(e.target.value);
                  if (pwErr) setPwErr(null);
                }}
                placeholder={t("facePwPlaceholder")}
                aria-invalid={pwErr ? true : undefined}
                aria-describedby={pwErr ? "face-pw-err" : undefined}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              {pwErr && (
                <p
                  id="face-pw-err"
                  role="alert"
                  className="mt-1.5 text-[11px] font-medium text-rose-600"
                >
                  {pwErr}
                </p>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                disabled={!consent || pw.length < 1 || gateBusy}
                onClick={() => void confirmGate()}
                className="btn-primary flex items-center justify-center gap-1.5 py-3 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {gateBusy && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {t("faceContinue")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                {t("faceCancel")}
              </button>
            </div>
          </div>
        )}

        {/* ===== 2) КАМЕРА / СКАН / ЛАЙВЛЕС ===== */}
        {(phase === "starting" || phase === "scan" || phase === "capture" || phase === "submit") && (
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-950">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
                aria-hidden
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                aria-hidden
              />

              {phase === "starting" && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950/70">
                  <div className="flex flex-col items-center gap-2 text-slate-200">
                    <Loader2 className="animate-spin" size={26} aria-hidden />
                    <span className="text-xs">{t("faceStarting")}</span>
                  </div>
                </div>
              )}

              {/* Ҳолат (aria-live) */}
              {phase !== "starting" && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`absolute inset-x-2 bottom-2 rounded-xl px-3 py-1.5 text-center text-[11px] font-medium backdrop-blur-sm ${
                    hint === "liveness"
                      ? "bg-sky-500/25 text-sky-100"
                      : hint === "capturing"
                        ? "bg-emerald-500/25 text-emerald-100"
                        : hint === "looking"
                          ? "bg-slate-800/70 text-slate-200"
                          : "bg-amber-500/25 text-amber-100"
                  }`}
                >
                  {phase === "submit"
                    ? t("faceChecking")
                    : phase === "capture"
                      ? t("faceCapturing")
                      : t(hintKey)}
                </div>
              )}
            </div>

            {/* Чолиши лайвлес — калон ва возеҳ + пешрафти чашм задан */}
            {phase === "scan" && hint === "liveness" && challenge && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                </span>
                <span className="text-[13px] font-semibold leading-snug text-sky-800">
                  {t(challengeKey)}
                </span>
                {challenge.action === "blink" && (
                  <span aria-hidden className="ml-auto flex shrink-0 gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        blinkProg >= 1 ? "bg-sky-500" : "bg-sky-200"
                      }`}
                    />
                    <span
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        blinkProg >= 2 ? "bg-sky-500" : "bg-sky-200"
                      }`}
                    />
                  </span>
                )}
              </div>
            )}

            {phase === "submit" && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={16} aria-hidden />
                {mode === "login" ? t("faceChecking") : t("faceSaving")}
              </div>
            )}
          </div>
        )}

        {/* ===== 3) МУВАФФАҚИЯТ ===== */}
        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={34} aria-hidden />
            </div>
            <p className="text-base font-bold text-slate-800">
              {mode === "login" ? t("faceSuccessLogin") : t("faceSuccessEnroll")}
            </p>
          </div>
        )}

        {/* ===== 4) ХАТО ===== */}
        {phase === "error" && (
          <div className="space-y-3" role="alert">
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-800">{t(errTitle[errKind])}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-rose-600/90">
                  {errKind === "denied"
                    ? t("faceDeniedNote")
                    : errKind === "insecure"
                      ? t("faceInsecureNote")
                      : errKind === "nomatch"
                        ? t("faceNotMatchedNote")
                        : errKind === "models"
                          ? t("faceModelsNote")
                          : t("faceErrorNote")}
                </p>
              </div>
            </div>

            {errKind === "insecure" && (
              <a
                href={httpsUrl()}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                <ShieldCheck size={17} aria-hidden />
                {t("faceOpenHttps")}
              </a>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void begin()}
                className="btn-primary flex items-center justify-center gap-2 py-3"
              >
                <RefreshCw size={16} aria-hidden />
                {t("faceRetry")}
              </button>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <KeyRound size={16} aria-hidden />
                  {t("faceFallbackPw")}
                </button>
              )}
              {mode === "login" && errKind !== "insecure" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 py-3 text-sm text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] sm:col-span-2"
                >
                  {t("faceCancel")}
                </button>
              )}
              {mode === "enroll" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 py-3 text-sm text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t("faceCancel")}
                </button>
              )}
            </div>

            {errKind === "nocam" && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <CameraOff size={13} aria-hidden />
                {t("faceNoCameraNote")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
