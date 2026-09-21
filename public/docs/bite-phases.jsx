import React, { useState, useEffect, useRef } from "react";

const WHITE = "#fbfbfd";
const LIGHT = "#f5f5f7";
const BLACK = "#1d1d1f";
const GRAY = "#86868b";
const DIVIDER = "#d2d2d7";
const LINK = "#2997ff";
const RED = "#e53935";
const GREEN = "#34c759";
const CARD = "#ffffff";

const CA = "0x00000000000000000000000000000000BITE";
const TOTAL = 1000000000;

/* ── Fade ── */
function useFade() {
  var ref = useRef(null);
  var [v, setV] = useState(false);
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    var o = new IntersectionObserver(function(e) { if (e[0].isIntersecting) { setV(true); o.disconnect(); } }, { threshold: 0.1 });
    o.observe(el);
    return function() { o.disconnect(); };
  }, []);
  return [ref, v];
}
function Fade({ children, delay }) {
  var [ref, v] = useFade();
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.6s ease " + (delay || 0) + "s, transform 0.6s ease " + (delay || 0) + "s" }}>{children}</div>;
}

/* ── Apple SVG with configurable bite ── */
function Apple({ pct, onClick }) {
  var bp = Math.min(Math.max(pct, 0), 80);
  var biteR = bp > 0 ? 16 + bp * 0.4 : 0;
  var biteX = 138 - (bp / 100) * 55;
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", textAlign: "center", padding: "16px 0" }}>
      <svg viewBox="0 0 200 220" style={{ width: "100%", maxWidth: 220, height: "auto" }}>
        <defs>
          <mask id="bm"><rect width="200" height="220" fill="white" />{bp > 0 && <circle cx={biteX + 14} cy="105" r={biteR} fill="black" />}</mask>
          <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ef5350" /><stop offset="100%" stopColor="#c62828" /></linearGradient>
        </defs>
        <path d="M 100 35 Q 102 20 98 12" stroke="#5d4037" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M 100 22 Q 116 10 128 18 Q 120 26 104 25" fill="#66bb6a" />
        <g mask="url(#bm)">
          <path d="M 55 50 Q 30 60 30 110 Q 30 170 65 190 Q 85 200 100 195 Q 115 200 135 190 Q 170 170 170 110 Q 170 60 145 50 Q 130 44 115 48 Q 105 52 100 52 Q 95 52 85 48 Q 70 44 55 50" fill="url(#ag)" />
          <path d="M 62 60 Q 48 78 52 108 Q 54 96 62 76" fill="#ef5350" opacity="0.4" />
        </g>
        {bp > 0 && <circle cx={biteX + 14} cy="105" r={biteR - 2} fill="#fff9c4" stroke="#f5e6a0" strokeWidth="0.5" />}
        {bp > 12 && <ellipse cx={biteX + 20} cy="100" rx="2.5" ry="4.5" fill="#5d4037" transform={"rotate(12 " + (biteX + 20) + " 100)"} />}
        {bp > 12 && <ellipse cx={biteX + 16} cy="112" rx="2.5" ry="4.5" fill="#5d4037" transform={"rotate(-8 " + (biteX + 16) + " 112)"} />}
      </svg>
    </div>
  );
}

/* ── Countdown ── */
function Countdown({ days }) {
  var d = Math.floor(days);
  var h = Math.floor((days % 1) * 24);
  var m = Math.floor(((days * 24) % 1) * 60);
  var s = Math.floor(((days * 1440) % 1) * 60);
  var Cell = function(props) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: days < 3 ? RED : BLACK, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {String(props.v).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 10, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{props.l}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
      <Cell v={d} l="days" /><Cell v={h} l="hours" /><Cell v={m} l="min" /><Cell v={s} l="sec" />
    </div>
  );
}

/* ── Phase indicator ── */
function PhaseBar({ act }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "16px 20px" }}>
      {[1, 2, 3].map(function(n) {
        var active = n === act;
        var past = n < act;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 24,
              background: active ? RED : past ? GREEN : LIGHT,
              border: active ? "none" : past ? "none" : "1.5px solid " + DIVIDER,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: active || past ? "#fff" : GRAY,
            }}>{past ? "✓" : n}</div>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? BLACK : GRAY }}>
              {n === 1 ? "Finding the apple" : n === 2 ? "First bite" : "To the core"}
            </span>
            {n < 3 && <div style={{ width: 20, height: 1, background: DIVIDER, margin: "0 2px" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── How card ── */
function HowCard({ icon, title, body, locked }) {
  return (
    <div style={{
      minWidth: 260, maxWidth: 280, scrollSnapAlign: "start",
      background: locked ? LIGHT : CARD, borderRadius: 18, padding: "24px 20px",
      border: "1px solid " + DIVIDER, opacity: locked ? 0.55 : 1,
      position: "relative",
    }}>
      {locked && (
        <div style={{
          position: "absolute", top: 12, right: 12, background: DIVIDER,
          borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 600, color: GRAY,
        }}>Coming in Act II</div>
      )}
      <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: locked ? GRAY : BLACK, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: GRAY, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

/* ── Bento leaderboard ── */
var EATERS_FULL = [
  { rank: 1, name: "0xorchard.eth", burned: "142,800", buys: 34, sells: 8 },
  { rank: 2, name: "0xfarmer.eth", burned: "98,400", buys: 22, sells: 5 },
  { rank: 3, name: "coreeater.eth", burned: "76,200", buys: 18, sells: 12 },
  { rank: 4, name: "0xseed.eth", burned: "41,000", buys: 9, sells: 3 },
  { rank: 5, name: "applepie.eth", burned: "28,600", buys: 14, sells: 6 },
  { rank: 6, name: "0xworm.eth", burned: "12,100", buys: 7, sells: 2 },
];

function BentoBoard({ eaters }) {
  if (!eaters || eaters.length === 0) {
    return (
      <div style={{ background: LIGHT, borderRadius: 18, padding: "40px 20px", textAlign: "center", border: "1px solid " + DIVIDER }}>
        <div style={{ fontSize: 17, color: GRAY }}>No bites yet. Be first.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
      <div style={{ background: LIGHT, borderRadius: 18, padding: "24px 20px", border: "1px solid " + DIVIDER }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: RED, lineHeight: 1 }}>1</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: BLACK, marginTop: 4 }}>{eaters[0].name}</div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>burned {eaters[0].burned} · {eaters[0].buys} buys · {eaters[0].sells} sells</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: BLACK }}>{eaters[0].burned}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {eaters.slice(1, 3).map(function(e) {
          return (
            <div key={e.rank} style={{ background: LIGHT, borderRadius: 18, padding: "18px 16px", border: "1px solid " + DIVIDER }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: e.rank === 2 ? RED : GRAY, lineHeight: 1 }}>{e.rank}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: BLACK, marginTop: 4 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 3 }}>{e.burned} burned</div>
            </div>
          );
        })}
      </div>
      {eaters.length > 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {eaters.slice(3, 6).map(function(e) {
            return (
              <div key={e.rank} style={{ background: LIGHT, borderRadius: 14, padding: "12px 10px", border: "1px solid " + DIVIDER, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: GRAY }}>{e.rank}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: BLACK, marginTop: 2 }}>{e.name.length > 12 ? e.name.slice(0, 10) + "…" : e.name}</div>
                <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{e.burned}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Meta wager info button + modal ── */
function MetaInfo() {
  var [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={function() { setOpen(true); }} style={{
        cursor: "pointer", background: "none", border: "1.5px solid " + DIVIDER,
        borderRadius: 20, width: 20, height: 20, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 11, fontWeight: 700, color: GRAY, padding: 0,
      }}>?</button>
      {open && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={function() { setOpen(false); }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{
            background: WHITE, borderRadius: 20, padding: "28px 24px", maxWidth: 380,
            width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: BLACK }}>The Meta Wager</span>
              <button onClick={function() { setOpen(false); }} style={{
                cursor: "pointer", background: LIGHT, border: "none", borderRadius: 20,
                width: 28, height: 28, fontSize: 16, color: GRAY, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
            <div style={{ fontSize: 15, color: GRAY, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px" }}>
                A side bet on the outcome. Two sides:
              </p>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: GREEN + "10", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>🍎</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginTop: 4 }}>CORE</div>
                  <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>The 50% target is reached before the deadline.</div>
                </div>
                <div style={{ flex: 1, background: "#d4a04a10", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>🪱</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#d4a04a", marginTop: 4 }}>ROT</div>
                  <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>The deadline passes before 50% is burned.</div>
                </div>
              </div>
              <p style={{ margin: "0 0 10px" }}>
                Stake $BITE on either side. Odds shift with every wager. Winners split the pot proportionally.
              </p>
              <p style={{ margin: 0, fontStyle: "italic", fontSize: 13, color: DIVIDER }}>
                The eaters want to reach the core. The worms bet they won't.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Meta wager empty state (Act II) ── */
function MetaWagerEmpty() {
  return (
    <div style={{
      background: LIGHT, borderRadius: 18, padding: "28px 20px",
      border: "1.5px dashed " + DIVIDER, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🍎 ⚔️ 🪱</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: BLACK, marginBottom: 6 }}>
        Core or rot?
      </div>
      <div style={{ fontSize: 14, color: GRAY, lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>
        The meta wager opens when the burn hits 10%. Pick a side — will the eaters reach the core, or will the apple rot?
      </div>
      <div style={{
        marginTop: 16, display: "inline-block", background: DIVIDER, borderRadius: 20,
        padding: "6px 16px", fontSize: 12, fontWeight: 600, color: GRAY,
      }}>
        Opens at 10% burned
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ background: DIVIDER, borderRadius: 4, height: 6, maxWidth: 200, margin: "0 auto", overflow: "hidden" }}>
          <div style={{ width: "42%", height: "100%", background: DIVIDER, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 11, color: DIVIDER, marginTop: 4 }}>4.2% of 10% threshold</div>
      </div>
    </div>
  );
}

/* ── Meta wager bar ── */
function MetaWager({ corePct }) {
  var rotPct = 100 - corePct;
  return (
    <div style={{ background: CARD, borderRadius: 18, padding: "22px 20px", border: "1px solid " + DIVIDER }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>🍎 CORE {corePct}%</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: GRAY }}>ROT {rotPct}% 🪱</span>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: LIGHT }}>
        <div style={{ width: corePct + "%", background: GREEN, transition: "width 0.5s ease" }} />
        <div style={{ width: rotPct + "%", background: "#d4a04a", transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 12, color: GRAY, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
        The worms are betting against you.<br />
        <span style={{ fontWeight: 600, color: BLACK }}>Pick a side. Stake your $BITE.</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1, cursor: "pointer", textAlign: "center", padding: "10px", borderRadius: 10, background: GREEN + "15", border: "1.5px solid " + GREEN, fontSize: 14, fontWeight: 700, color: GREEN }}>
          Bet CORE
        </div>
        <div style={{ flex: 1, cursor: "pointer", textAlign: "center", padding: "10px", borderRadius: 10, background: "#d4a04a15", border: "1.5px solid #d4a04a", fontSize: 14, fontWeight: 700, color: "#d4a04a" }}>
          Bet ROT
        </div>
      </div>
    </div>
  );
}

/* ── CopyBtn ── */
function CopyBtn({ text }) {
  var [c, setC] = useState(false);
  return (
    <button onClick={function() { navigator.clipboard.writeText(text).catch(function() {}); setC(true); setTimeout(function() { setC(false); }, 2000); }}
      style={{ cursor: "pointer", background: "none", border: "none", color: LINK, fontSize: 15, padding: 0 }}>
      {c ? "Copied." : "Copy address →"}
    </button>
  );
}

/* ════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════ */
export default function App() {
  var [act, setAct] = useState(1);

  var burnPct = act === 1 ? 0 : act === 2 ? 4.2 : 38.7;
  var burned = Math.round(TOTAL * burnPct / 100);
  var remaining = TOTAL - burned;
  var daysLeft = act === 2 ? 20.6 : act === 3 ? 4.3 : 0;

  return (
    <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif", WebkitFontSmoothing: "antialiased", background: WHITE, color: BLACK }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(251,251,253,0.82)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid " + DIVIDER, padding: "0 20px", height: 48,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ maxWidth: 980, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: BLACK }}>$BITE</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase",
              padding: "3px 10px", borderRadius: 20,
              background: act === 1 ? LIGHT : act === 2 ? GREEN + "18" : RED + "18",
              color: act === 1 ? GRAY : act === 2 ? GREEN : RED,
              border: "1px solid " + (act === 1 ? DIVIDER : act === 2 ? GREEN + "44" : RED + "44"),
            }}>
              {act === 1 ? "Preparing" : act === 2 ? "Live" : "Racing"}
            </span>
            <div style={{ cursor: "pointer", background: LINK, color: "#fff", borderRadius: 980, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>Buy</div>
          </div>
        </div>
      </nav>

      {/* ── PHASE SWITCHER (dev preview) ── */}
      <div style={{ background: "#1d1d1f", padding: "10px 20px", display: "flex", justifyContent: "center", gap: 8 }}>
        {[
          [1, "Act I — Finding the Apple"],
          [2, "Act II — First Bite"],
          [3, "Act III — To the Core"],
        ].map(function(item) {
          var n = item[0];
          var label = item[1];
          return (
            <button key={n} onClick={function() { setAct(n); }} style={{
              cursor: "pointer", padding: "6px 14px", borderRadius: 8, border: "none",
              background: act === n ? "#fff" : "#333", color: act === n ? BLACK : GRAY,
              fontSize: 12, fontWeight: 600,
            }}>{label}</button>
          );
        })}
      </div>

      {/* ── PHASE INDICATOR ── */}
      <PhaseBar act={act} />

      {/* ── ACT I BANNER ── */}
      {act === 1 && (
        <div style={{ background: LIGHT, textAlign: "center", padding: "10px 20px", fontSize: 13, color: GRAY, borderBottom: "1px solid " + DIVIDER, lineHeight: 1.5 }}>
          The orchard is being prepared. Trading is live — burns begin in Act II.
        </div>
      )}

      {/* ── ACT II BANNER — early eater multiplier ── */}
      {act === 2 && (
        <div style={{ background: RED + "10", textAlign: "center", padding: "10px 20px", fontSize: 13, color: RED, fontWeight: 600, borderBottom: "1px solid " + RED + "22" }}>
          🔥 EARLY EATER BONUS — Burns in the first 72 hours count 2× toward your leaderboard rank.
        </div>
      )}

      {/* ── ACT III BANNER — urgency ── */}
      {act === 3 && daysLeft < 7 && (
        <div style={{ background: RED + "10", textAlign: "center", padding: "10px 20px", fontSize: 13, color: RED, fontWeight: 600, borderBottom: "1px solid " + RED + "22" }}>
          🍎 {burnPct.toFixed(1)}% eaten. {daysLeft.toFixed(0)} days left. The whole orchard is watching.
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ padding: "60px 20px 40px", textAlign: "center", background: WHITE }}>
        <Fade>
          <h1 style={{ fontSize: "clamp(56px, 14vw, 96px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, margin: 0, color: BLACK }}>
            $BITE
          </h1>
          <p style={{ fontSize: "clamp(19px, 4vw, 28px)", fontWeight: 400, color: GRAY, marginTop: 8 }}>
            {act === 1 ? "Finding the right apple." : "Eat it to the core."}
          </p>
        </Fade>
        <Fade delay={0.1}>
          <Apple pct={burnPct} onClick={act > 1 ? function() {} : null} />
          {act > 1 && <p style={{ fontSize: 13, color: GRAY, marginTop: 4 }}>Tap the apple.</p>}
        </Fade>
        <Fade delay={0.2}>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ cursor: "pointer", background: BLACK, color: WHITE, borderRadius: 980, padding: "12px 24px", fontSize: 15, fontWeight: 600 }}>
              Trade on PONS
            </div>
            <a href="#how" style={{ color: LINK, fontSize: 15, textDecoration: "none", display: "flex", alignItems: "center" }}>
              {act === 1 ? "What's coming ↓" : "How eating works ↓"}
            </a>
          </div>
        </Fade>
      </section>

      {/* ── COUNTDOWN + PROGRESS (Act II & III only) ── */}
      {act > 1 && (
        <div style={{ background: LIGHT, padding: "28px 20px", textAlign: "center" }}>
          <Fade>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 14px" }}>To the core</p>
              <Countdown days={daysLeft} />
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: GRAY }}>{remaining.toLocaleString()} remaining</span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: RED }}>{burnPct.toFixed(1)}%</span>
                </div>
                <div style={{ background: DIVIDER, borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: burnPct + "%", height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #66bb6a, " + RED + ")", transition: "width 1s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: GRAY, marginTop: 6, textAlign: "right" }}>{burned.toLocaleString()} burned</div>
              </div>
            </div>
          </Fade>
        </div>
      )}

      {/* ── THE LINE ── */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: WHITE }}>
        <Fade>
          <h2 style={{ fontSize: "clamp(26px, 6vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0, color: BLACK }}>
            {act === 1 ? "Every transaction\nwill take a bite." : "Every transaction\ntakes a bite."}
          </h2>
          <p style={{ fontSize: 17, color: GRAY, marginTop: 14, lineHeight: 1.5, maxWidth: 440, margin: "14px auto 0" }}>
            {act === 1
              ? "When the burn contract goes live in Act II, every buy, sell, and transfer will burn supply. Right now, you're accumulating. The race hasn't started."
              : "Buy. Sell. Transfer. Every time $BITE moves, supply is burned forever. The apple gets smaller. Your share gets bigger."}
          </p>
        </Fade>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: "60px 0", background: LIGHT }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px" }}>
          <Fade>
            <p style={{ fontSize: 17, color: GRAY, margin: "0 0 20px" }}>
              A few ways <span style={{ color: BLACK, fontWeight: 700 }}>$BITE gets smaller.</span>
            </p>
          </Fade>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", padding: "0 20px 12px", WebkitOverflowScrolling: "touch" }}>
          <HowCard icon="↔" title="Trade." body="Buys and sells both burn supply. Selling chews harder — a larger cut on the way out." locked={false} />
          <HowCard icon="👆" title="Tap." body="The only real burn. Destroy your $BITE directly and push toward the core." locked={act === 1} />
          <HowCard icon="◐" title="Digest." body="Creator fees split fifty-fifty. Half buys and burns. Half fills the prize pot." locked={act === 1} />
        </div>
      </section>

      {/* ── THE WAGER ── */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: WHITE }}>
        <Fade>
          <p style={{ fontSize: 12, fontWeight: 600, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 10px" }}>The wager</p>
          <h2 style={{ fontSize: "clamp(26px, 6vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, margin: 0, color: BLACK }}>
            Half the supply.<br />One deadline. One farmer.
          </h2>
          <p style={{ fontSize: 17, color: GRAY, marginTop: 14, lineHeight: 1.5, maxWidth: 460, margin: "14px auto 0" }}>
            Burn 50% of the burnable supply before the deadline. Reach the core and the prize pot pays eaters. Miss it, and the apple rots. Only the farmer is paid.
          </p>
          <p style={{ fontSize: 13, color: GRAY, marginTop: 10, fontStyle: "italic" }}>
            The farmer is the deployer. The eaters are you. This is not a metaphor. It is fruit.
          </p>
        </Fade>
      </section>

      {/* ── META WAGER — three states ── */}
      {act >= 2 && (
        <section style={{ padding: "0 20px 60px", background: WHITE }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <Fade>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>The meta wager</p>
                <MetaInfo />
              </div>
              {act === 2 ? <MetaWagerEmpty /> : <MetaWager corePct={68} />}
            </Fade>
          </div>
        </section>
      )}

      {/* ── BIGGEST EATERS ── */}
      <section style={{ padding: "60px 20px", background: LIGHT }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <Fade>
            <p style={{ fontSize: 17, color: GRAY, margin: "0 0 16px" }}>
              Who <span style={{ color: BLACK, fontWeight: 700 }}>ate the most.</span>
            </p>
          </Fade>
          <Fade delay={0.1}>
            <BentoBoard eaters={act === 1 ? [] : act === 2 ? EATERS_FULL.slice(0, 2) : EATERS_FULL} />
          </Fade>
          {act === 1 && (
            <p style={{ fontSize: 13, color: GRAY, marginTop: 12, textAlign: "center", fontStyle: "italic" }}>
              The leaderboard activates when the race begins in Act II.
            </p>
          )}
        </div>
      </section>

      {/* ── WHY AAPL ── */}
      <section style={{ padding: "80px 20px", background: WHITE }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <Fade>
            <p style={{ fontSize: 12, fontWeight: 600, color: GRAY, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 10px" }}>Why AAPL</p>
            <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, margin: 0, color: BLACK }}>
              The most valuable company on earth,<br />being eaten alive.
            </h2>
            <p style={{ fontSize: 15, color: GRAY, marginTop: 14, lineHeight: 1.5 }}>
              The Apple logo is an apple with a bite taken out of it. Rob Janoff designed it in 1977. He said the bite was for scale — so you'd know it was an apple, not a cherry.
            </p>
            <p style={{ fontSize: 15, color: GRAY, marginTop: 10, lineHeight: 1.5 }}>
              $BITE is priced in AAPL. A three-trillion-dollar company, denominated in a token whose entire purpose is to be consumed.
            </p>
          </Fade>
        </div>
      </section>

      {/* ── SPECS ── */}
      <section style={{ padding: "40px 20px", background: LIGHT }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <Fade>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: DIVIDER, gap: 1, borderRadius: 14, overflow: "hidden" }}>
              {[
                ["Chain", "Robinhood\n4663"],
                ["Standard", "ERC-20"],
                ["Pair", "AAPL"],
                ["Mechanism", "Burn on\nevery tx"],
                ["Phase", "Act " + act + " of 3"],
                ["Burned", burnPct.toFixed(1) + "%"],
              ].map(function(item, i) {
                return (
                  <div key={i} style={{ background: CARD, padding: "18px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: GRAY, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>{item[0]}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: BLACK, whiteSpace: "pre-line", lineHeight: 1.3 }}>{item[1]}</div>
                  </div>
                );
              })}
            </div>
          </Fade>
        </div>
      </section>

      {/* ── TAKE A $BITE ── */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: WHITE }}>
        <Fade>
          <h2 style={{ fontSize: "clamp(32px, 7vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0, color: BLACK }}>
            Take a $BITE.
          </h2>
          <div style={{ marginTop: 24, display: "inline-block", background: LIGHT, borderRadius: 16, padding: "20px 22px", border: "1px solid " + DIVIDER }}>
            <div style={{ fontFamily: "ui-monospace, 'SF Mono', monospace", fontSize: 12, color: GRAY, wordBreak: "break-all", lineHeight: 1.6, maxWidth: 300 }}>{CA}</div>
            <div style={{ marginTop: 10 }}><CopyBtn text={CA} /></div>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "inline-block", cursor: "pointer", background: BLACK, color: WHITE, borderRadius: 980, padding: "14px 28px", fontSize: 17, fontWeight: 600 }}>Buy on PONS</div>
          </div>
          <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 14 }}>
            <a href="#" style={{ fontSize: 15, color: LINK, textDecoration: "none" }}>Twitter</a>
            <a href="#" style={{ fontSize: 15, color: LINK, textDecoration: "none" }}>Telegram</a>
            <a href="#" style={{ fontSize: 15, color: LINK, textDecoration: "none" }}>Chart</a>
          </div>
        </Fade>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "20px 20px 36px", borderTop: "1px solid " + DIVIDER, background: WHITE, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: GRAY, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
          $BITE is a deflationary memecoin on Robinhood Chain. Every transaction burns supply. That is not financial advice. That is fruit.
        </p>
        <p style={{ fontSize: 11, color: DIVIDER, marginTop: 8 }}>$BITE × AAPL · Robinhood Chain · 4663</p>
      </footer>

    </div>
  );
}
