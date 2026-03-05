import React, { useState, useEffect } from 'react';
import {
  Activity,
  Wind,
  CheckCircle,
  Clock,
  Terminal,
  ShieldAlert,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

export default function App() {
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle, inhale, exhale, cooldown, done

  // User-adjustable protocol settings
  const [inhaleSeconds, setInhaleSeconds] = useState(3); // slow deep inhale duration
  const [holdSeconds, setHoldSeconds] = useState(3); // sustained out-breath duration
  const [repsTarget, setRepsTarget] = useState(5); // reps per session

  // UX settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const [timer, setTimer] = useState(holdSeconds);
  const [logs, setLogs] = useState([]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  // ---- Helpers ----
  const clampHold = (v) => Math.max(1, Math.min(10, v));
  const clampInhale = (v) => Math.max(1, Math.min(10, v));
  const clampReps = (v) => Math.max(1, Math.min(20, v));

  const safeHold = clampHold(holdSeconds);
  const safeInhale = clampInhale(inhaleSeconds);
  const safeRepsTarget = clampReps(repsTarget);

  const applyPreset = (preset) => {
    if (phase !== 'idle') return;

    if (preset === 'hospital') {
      setInhaleSeconds(3);
      setHoldSeconds(3);
      setRepsTarget(5);
    } else if (preset === 'physio') {
      setInhaleSeconds(4);
      setHoldSeconds(5);
      setRepsTarget(10);
    } else if (preset === 'quick') {
      setInhaleSeconds(2);
      setHoldSeconds(2);
      setRepsTarget(3);
    }
  };

  const saveDefaults = () => {
    try {
      const payload = {
        inhaleSeconds: safeInhale,
        holdSeconds: safeHold,
        repsTarget: safeRepsTarget,
        soundEnabled,
      };
      localStorage.setItem('steveBallGameDefaults', JSON.stringify(payload));
    } catch (e) {
      // ignore storage errors
    }
  };

  // Update current hour periodically so the UI stays fresh if left open
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Load saved defaults on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('steveBallGameDefaults');
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.inhaleSeconds === 'number') setInhaleSeconds(clampInhale(d.inhaleSeconds));
        if (typeof d.holdSeconds === 'number') setHoldSeconds(clampHold(d.holdSeconds));
        if (typeof d.repsTarget === 'number') setRepsTarget(clampReps(d.repsTarget));
        if (typeof d.soundEnabled === 'boolean') setSoundEnabled(d.soundEnabled);
      }
    } catch (e) {
      // ignore corrupted defaults
    } finally {
      setDefaultsLoaded(true);
    }
  }, []);

  // Keep timer aligned to holdSeconds when idle
  useEffect(() => {
    if (phase === 'idle') setTimer(safeHold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdSeconds, phase]);

  const startRep = () => {
    if (phase !== 'idle') return;

    setPhase('inhale');

    // Inhale phase: user-selected seconds to breathe in deeply and slowly
    setTimeout(() => {
      setPhase('exhale');
      setTimer(safeHold); // sustained out-breath timer starts
    }, safeInhale * 1000);
  };

  const logCurrentHour = () => {
    const hour = new Date().getHours();
    setLogs((prev) => {
      // Prevent duplicate logging for the same hour
      if (prev.some((log) => log.hour === hour)) return prev;
      return [
        ...prev,
        {
          hour,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
  };

  // Exhale countdown + rep completion
  useEffect(() => {
    if (phase === 'exhale') {
      if (timer > 0) {
        const interval = setInterval(() => setTimer((t) => t - 1), 1000);
        return () => clearInterval(interval);
      } else {
        setPhase('cooldown');
        // Cooldown/rest phase: 2 seconds before ready for next rep
        setTimeout(() => {
          setReps((r) => {
            const newReps = r + 1;

            if (newReps >= safeRepsTarget) {
              setPhase('done');
              logCurrentHour();
              setTimeout(() => {
                setReps(0);
                setPhase('idle');
              }, 3000); // Show "Quest Complete" for 3 seconds before resetting
              return newReps;
            }

            setPhase('idle');
            return newReps;
          });
        }, 2000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timer, repsTarget]);

  const getPhaseMessage = () => {
    switch (phase) {
      case 'inhale':
        return 'DEEP BREATH IN... (Nice & slow)';
      case 'exhale':
        return 'BLOW OUT STEADILY! (Keep it up)';
      case 'cooldown':
        return 'RELAX AND RECOVER...';
      case 'done':
        return 'HOURLY QUEST COMPLETE!';
      default:
        return 'TAP THE TUBE TO START';
    }
  };

  // ---- Audio cues (simple beeps) ----
  const playBeep = (freq = 880, durationMs = 120, gain = 0.03) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = gain;

      osc.connect(g);
      g.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + durationMs / 1000);

      osc.onended = () => {
        try {
          ctx.close();
        } catch (e) {}
      };
    } catch (e) {
      // ignore audio failures
    }
  };

  const playCue = (p) => {
    if (p === 'inhale') playBeep(660, 120);
    if (p === 'exhale') playBeep(880, 140);
    if (p === 'cooldown') playBeep(440, 100);
    if (p === 'done') {
      playBeep(988, 120);
      setTimeout(() => playBeep(784, 120), 140);
      setTimeout(() => playBeep(1046, 140), 280);
    }
  };

  useEffect(() => {
    if (!defaultsLoaded) return;
    playCue(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, defaultsLoaded, soundEnabled]);

  // Generate a schedule from 8 AM to 8 PM (hospital waking hours)
  const scheduleHours = Array.from({ length: 13 }, (_, i) => i + 8);

  // Determine ball visual state based on phase
  let ballBottom = '16px'; // Default bottom position
  let ballColor = '#64748b'; // slate-500
  let isBobbling = false;

  switch (phase) {
    case 'inhale':
      ballBottom = '16px';
      ballColor = '#22d3ee'; // cyan-400
      break;
    case 'exhale':
      ballBottom = '180px'; // Up in the target zone
      ballColor = '#34d399'; // emerald-400
      isBobbling = true;
      break;
    case 'cooldown':
      ballBottom = '16px';
      ballColor = '#818cf8'; // indigo-400
      break;
    case 'done':
      ballBottom = '100px';
      ballColor = '#facc15'; // yellow-400
      isBobbling = true;
      break;
    default:
      ballBottom = '16px';
      ballColor = '#64748b';
  }

  // Progress Bar Blocks (Geeky ASCII style)
  const renderProgressBar = () => {
    const blocks = [];
    const safeTarget = safeRepsTarget;
    for (let i = 0; i < safeTarget; i++) {
      blocks.push(
        <div
          key={i}
          className={`h-6 flex-1 mx-0.5 rounded-sm transition-colors duration-300 ${
            i < reps
              ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
              : 'bg-slate-800'
          }`}
        />
      );
    }
    return blocks;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-mono flex flex-col items-center p-4 md:p-8 selection:bg-cyan-900">
      {/* Header */}
      <header className="w-full max-w-2xl mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400 w-8 h-8 animate-pulse" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-cyan-50 tracking-wider">
              STEVE'S BALL GAME
            </h1>
            <p className="text-xs text-cyan-600/80">SPIROMETER PACING PROTOCOL</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-sm text-slate-500">USER: STEVE</div>
          <div className="text-xs text-emerald-500 flex items-center gap-1 justify-end">
            <ShieldAlert className="w-3 h-3" /> STATUS: RIB RECOVERY
          </div>
        </div>
      </header>

      <main className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Active Exercise Interface */}
        <section className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          {/* Scanline overlay effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 z-0"></div>

          <h2 className="text-lg font-semibold text-slate-100 mb-2 z-10 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            CURRENT_SESSION
          </h2>

          <div className="text-xs text-slate-500 mb-6 z-10 text-center">
            TARGET: {safeRepsTarget} REP CYCLES ({safeHold}s SUSTAINED OUT BREATH)
          </div>

          {/* Digital Spirometer Visualizer */}
          <div className="h-72 flex items-center justify-center w-full z-10 mb-6 relative">
            <div
              className={`relative w-28 h-64 bg-slate-950 border-4 ${
                phase === 'idle'
                  ? 'border-slate-700 hover:border-cyan-500 cursor-pointer'
                  : 'border-slate-700'
              } rounded-full overflow-hidden shadow-inner flex justify-center`}
              onClick={phase === 'idle' ? startRep : undefined}
            >
              {/* Target Zone Line */}
              <div className="absolute w-full h-1 bg-emerald-400/80 top-16 z-10 border-b border-dashed border-emerald-300"></div>
              <div className="absolute w-full h-24 bg-emerald-500/10 top-16 z-0"></div>

              {/* Target Zone Label */}
              <div className="absolute top-10 text-[10px] text-emerald-400/60 font-bold tracking-widest z-0">
                TARGET ZONE
              </div>

              {/* The Ball */}
              <div
                className="absolute w-16 h-16 rounded-full z-20 shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all flex items-center justify-center"
                style={{
                  bottom: ballBottom,
                  backgroundColor: ballColor,
                  transitionDuration: phase === 'exhale' ? '1500ms' : '800ms',
                  transitionTimingFunction: 'ease-out',
                  animation: isBobbling ? 'bobble 2s infinite ease-in-out' : 'none',
                  boxShadow:
                    phase === 'exhale'
                      ? '0 0 30px rgba(52,211,153,0.6)'
                      : 'inset -4px -4px 10px rgba(0,0,0,0.3), inset 4px 4px 10px rgba(255,255,255,0.3)',
                }}
              >
                {/* 3D shine effect on the ball */}
                <div className="absolute top-2 left-3 w-4 h-4 bg-white/40 rounded-full blur-[1px]"></div>

                {/* Timer display on the ball during exhale */}
                {phase === 'exhale' && (
                  <span className="text-emerald-950 font-bold text-2xl drop-shadow-sm z-30">
                    {timer}
                  </span>
                )}
              </div>

              {/* Idle State Icon */}
              {phase === 'idle' && (
                <div className="absolute bottom-20 flex flex-col items-center opacity-50 pointer-events-none">
                  <Wind className="w-8 h-8 text-cyan-400 mb-1" />
                  <span className="text-[10px] font-bold text-cyan-400">START</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div
            className={`text-sm font-bold tracking-widest mb-6 z-10 h-6 flex items-center gap-2 ${
              phase === 'exhale'
                ? 'text-emerald-400'
                : phase === 'done'
                ? 'text-yellow-400'
                : 'text-cyan-400'
            }`}
          >
            {phase === 'inhale' && <ArrowDownCircle className="w-4 h-4" />}
            {phase === 'exhale' && <ArrowUpCircle className="w-4 h-4" />}
            {getPhaseMessage()}
          </div>

          {/* Progress Bar */}
          <div className="w-full z-10">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">REP PROGRESS</span>
              <span className="text-cyan-400 font-bold">
                {reps} / {safeRepsTarget}
              </span>
            </div>
            <div className="flex w-full bg-slate-950 p-1 rounded-md border border-slate-800">
              {renderProgressBar()}
            </div>
          </div>
        </section>

        {/* Right Column: Daily Log */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col max-h-[600px]">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2 border-b border-slate-800 pb-4">
            <Clock className="w-5 h-5 text-indigo-400" />
            DAILY_LOG (HOURLY)
          </h2>

          {/* Settings */}
          <div className="mb-4 p-4 rounded-lg border border-slate-800 bg-slate-950/40">
            <div className="text-xs text-slate-400 font-bold tracking-widest mb-3">
              SETTINGS
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 flex flex-col gap-1">
                INHALE (seconds)
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={safeInhale}
                  disabled={phase !== 'idle'}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setInhaleSeconds(Number.isFinite(v) ? clampInhale(v) : 3);
                  }}
                  className="mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>1</span>
                  <span className="text-slate-400">{safeInhale}s</span>
                  <span>10</span>
                </div>
                {phase !== 'idle' && (
                  <span className="text-[10px] text-slate-600">Locked during a rep</span>
                )}
              </label>

              <label className="text-xs text-slate-400 flex flex-col gap-1">
                HOLD (seconds)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={safeHold}
                  disabled={phase !== 'idle'}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setHoldSeconds(Number.isFinite(v) ? clampHold(v) : 3);
                    if (phase === 'idle') setTimer(Number.isFinite(v) ? clampHold(v) : 3);
                  }}
                  className="mt-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                />
                {phase !== 'idle' && (
                  <span className="text-[10px] text-slate-600">Locked during a rep</span>
                )}
              </label>

              <label className="text-xs text-slate-400 flex flex-col gap-1">
                REPS (per session)
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={safeRepsTarget}
                  disabled={phase !== 'idle'}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setRepsTarget(Number.isFinite(v) ? clampReps(v) : 5);
                  }}
                  className="mt-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                />
                {phase !== 'idle' && (
                  <span className="text-[10px] text-slate-600">Locked during a rep</span>
                )}
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={() => applyPreset('hospital')}
                className={`px-3 py-2 rounded-md border text-xs font-bold tracking-wider ${
                  phase !== 'idle'
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-cyan-600 hover:text-cyan-200'
                } border-slate-800 bg-slate-950 text-slate-300`}
              >
                Hospital Default
              </button>
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={() => applyPreset('physio')}
                className={`px-3 py-2 rounded-md border text-xs font-bold tracking-wider ${
                  phase !== 'idle'
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-emerald-600 hover:text-emerald-200'
                } border-slate-800 bg-slate-950 text-slate-300`}
              >
                Physio Mode
              </button>
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={() => applyPreset('quick')}
                className={`px-3 py-2 rounded-md border text-xs font-bold tracking-wider ${
                  phase !== 'idle'
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-indigo-600 hover:text-indigo-200'
                } border-slate-800 bg-slate-950 text-slate-300`}
              >
                Quick Win
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={saveDefaults}
                className={`px-3 py-2 rounded-md border text-xs font-bold tracking-wider ${
                  phase !== 'idle'
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-yellow-600 hover:text-yellow-200'
                } border-slate-800 bg-slate-950 text-slate-300`}
              >
                Save as default
              </button>

              <label className="flex items-center gap-2 text-xs text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="accent-cyan-500"
                />
                Audio cues
              </label>

              <span className="text-[10px] text-slate-600">
                (Sound may require a tap to enable in some browsers)
              </span>
            </div>

            <div className="mt-3 text-[10px] text-slate-500">
              Tip: adjust between reps. Presets are fast. “Save as default” stores your settings in
              this browser.
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {scheduleHours.map((hour) => {
              const isCompleted = logs.some((log) => log.hour === hour);
              const isCurrent = hour === currentHour;
              const isPast = hour < currentHour;

              let statusColor = 'text-slate-600';
              let dotColor = 'bg-slate-800';
              let textStatus = 'PENDING';

              if (isCompleted) {
                statusColor = 'text-emerald-400';
                dotColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
                textStatus = 'LOGGED';
              } else if (isCurrent) {
                statusColor = 'text-cyan-400';
                dotColor = 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]';
                textStatus = 'ACTIVE NOW';
              } else if (isPast) {
                statusColor = 'text-rose-900';
                dotColor = 'bg-rose-950 border border-rose-900';
                textStatus = 'MISSED';
              }

              // Format hour to AM/PM string
              const hourString = new Date(2000, 1, 1, hour).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <div
                  key={hour}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? 'bg-cyan-950/20 border-cyan-900/50'
                      : isCompleted
                      ? 'bg-emerald-950/10 border-emerald-900/30'
                      : 'bg-slate-950/50 border-transparent'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                  <div className="flex-1 text-sm">
                    <span className="text-slate-300 w-16 inline-block">{hourString}</span>
                  </div>
                  <div className={`text-xs font-bold tracking-wider flex items-center gap-2 ${statusColor}`}>
                    {isCompleted && <CheckCircle className="w-4 h-4" />}
                    {textStatus}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer Instructions */}
      <footer className="mt-8 text-xs text-slate-500 text-center max-w-xl">
        Tap the tube to start. Follow the visual guide: take a slow breath in for {safeInhale}s,
        then blow out steadily to &quot;keep the ball up&quot; for {safeHold}s. Protect those ribs,
        steady wins the race. Get well soon, Steve!
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bobble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `,
        }}
      />
    </div>
  );
}