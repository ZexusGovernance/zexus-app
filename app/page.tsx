"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// ─── Countdown target ──────────────────────────────────────────────────────
// Change this when you set a more precise mainnet launch date.
const LAUNCH_DATE = new Date("2026-07-01T00:00:00Z");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(): TimeLeft {
  const diff = Math.max(0, LAUNCH_DATE.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function ComingSoonPage() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTimeLeft(computeTimeLeft());
    const id = setInterval(() => setTimeLeft(computeTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-white font-sans">
      {/* Backgrounds */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(231, 198, 148, 0.10) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#E7C694] opacity-[0.12] blur-[100px]" />
        <div className="absolute -bottom-40 -right-32 w-[600px] h-[600px] rounded-full bg-[#A68B5B] opacity-[0.10] blur-[100px]" />
      </div>

      {/* Content */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 opacity-0 animate-fade-in">
          <Image
            src="/icon.png"
            alt="Zexus"
            width={56}
            height={56}
            priority
            className="h-14 w-14 object-contain"
          />
          <div className="flex flex-col items-start leading-none">
            <span className="text-2xl font-black text-white tracking-tighter">
              ZEXUS
            </span>
            <span className="text-[10px] font-mono text-[#E7C694] tracking-[0.4em] uppercase mt-1 opacity-80">
              Governance
            </span>
          </div>
        </div>

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E7C694]/5 border border-[#E7C694]/30 mb-10 opacity-0 animate-fade-in-delay-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-[#E7C694] animate-ping opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E7C694]" />
          </span>
          <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-[#E7C694]">
            Pre-Launch
          </span>
        </div>

        {/* Main headline */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-6 opacity-0 animate-fade-in-delay-2">
          The Zexus
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-tr from-[#A68B5B] via-[#FFFEEF] to-[#E7C694] drop-shadow-[0_5px_15px_rgba(231,198,148,0.2)]">
            App is Coming.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed font-light opacity-70 mb-14 opacity-0 animate-fade-in-delay-3">
          Voting. Trust Scores. Emergency Calls. The full Zexus protocol —
          launching on Base mainnet in Q3 2026.
        </p>

        {/* Countdown */}
        <div className="grid grid-cols-4 gap-3 sm:gap-5 mb-14 opacity-0 animate-fade-in-delay-4">
          <CountdownBox value={timeLeft?.days ?? 0} label="Days" />
          <CountdownBox value={timeLeft?.hours ?? 0} label="Hours" />
          <CountdownBox value={timeLeft?.minutes ?? 0} label="Min" />
          <CountdownBox value={timeLeft?.seconds ?? 0} label="Sec" />
        </div>

        {/* CTA back to waitlist */}
        <a
          href="https://zexus.xyz"
          className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full bg-[#0A0A0A] border border-[#E7C694]/30 text-[#E7C694] hover:border-[#E7C694] hover:shadow-[0_0_35px_rgba(231,198,148,0.15)] transition-all duration-500 opacity-0 animate-fade-in-delay-5"
        >
          <span className="text-sm font-bold uppercase tracking-[0.2em] group-hover:text-white transition-colors">
            ← Join the Waitlist
          </span>
        </a>

        {/* Footer line */}
        <p className="absolute bottom-8 text-[9px] tracking-[0.4em] uppercase text-gray-600 opacity-0 animate-fade-in-delay-6">
          zexus.xyz · Verify, Don&apos;t Trust
        </p>
      </section>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        :global(.animate-fade-in) {
          animation: fadeIn 0.8s ease-out forwards;
        }
        :global(.animate-fade-in-delay-1) {
          animation: fadeIn 0.8s ease-out 0.2s forwards;
        }
        :global(.animate-fade-in-delay-2) {
          animation: fadeIn 0.8s ease-out 0.4s forwards;
        }
        :global(.animate-fade-in-delay-3) {
          animation: fadeIn 0.8s ease-out 0.6s forwards;
        }
        :global(.animate-fade-in-delay-4) {
          animation: fadeIn 0.8s ease-out 0.8s forwards;
        }
        :global(.animate-fade-in-delay-5) {
          animation: fadeIn 0.8s ease-out 1s forwards;
        }
        :global(.animate-fade-in-delay-6) {
          animation: fadeIn 0.8s ease-out 1.2s forwards;
        }
      `}</style>
    </main>
  );
}

// ─── Countdown box ─────────────────────────────────────────────────────────

function CountdownBox({ value, label }: { value: number; label: string }) {
  const display = value.toString().padStart(2, "0");
  return (
    <div className="flex flex-col items-center min-w-[68px] sm:min-w-[88px] px-3 py-4 rounded-2xl bg-[#0A0A0A]/60 backdrop-blur-md border border-white/[0.06]">
      <span className="text-3xl sm:text-5xl font-black tracking-tighter text-white tabular-nums leading-none">
        {display}
      </span>
      <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-gray-500 mt-2">
        {label}
      </span>
    </div>
  );
}
