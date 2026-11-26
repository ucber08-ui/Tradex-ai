import fs from "fs";
const src = fs.readFileSync("index.html", "utf8");
const js = src.slice(src.indexOf("const CR="), src.indexOf("function svg("));
const K = { t: "" }, KEY = process.env.TWELVE_KEY || "";
const { CR, candles, analyze, decide, backtest, newsRisk, HTF } =
  new Function("K", js + ";return{CR,candles,analyze,decide,backtest,newsRisk,HTF}")(K);
const WATCH = (process.env.WATCH || "XAUUSD,BTCUSD,ETHUSD").split(",");
const TFS = (process.env.TFS || "M1,M5,M15").split(",");
const COOL = { M1: 20, M5: 30 };
let sent = {};
try { sent = JSON.parse(fs.readFileSync("sent.json", "utf8")); } catch {}
const tg = (text) => fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
});
const fx = (s) => !CR[s] && s !== "XAUUSD";

async function once() {
  for (const sym of WATCH) for (const tf of TFS) {
    try {
      K.t = fx(sym) ? KEY : "";
      const cs = await candles(sym, tf), a = analyze(cs), d = decide(a);
      if (d.side === "WAIT") continue;
      const key = `${sym}-${tf}-${d.side}`;
      if (Date.now() - (sent[key] || 0) < (COOL[tf] || 60) * 60000) continue;
      const B = d.side === "BUY", ht = HTF[tf];
      let hs = 0;
      if (ht !== tf) {
        const ha = analyze(await candles(sym, ht));
        hs = (ha.ema20 > ha.ema50 ? 1 : -1) + (ha.macdHist > 0 ? 1 : -1);
      }
      if (B ? hs < 0 : hs > 0) continue;
      const bt = backtest(cs);
      if (bt.n < 8 || bt.exp <= 0) continue;
      if (await newsRisk(sym)) continue;
      const dp = a.price < 10 ? 5 : 2, f = (v) => v.toFixed(dp);
      await tg(`${B ? "🟢 BUY" : "🔴 SELL"} ${sym} ${tf}\nKirish: ${f(d.entry)}\nSL: ${f(d.sl)}\nTP1: ${f(d.tp1)}\nTP2: ${f(d.tp2)}\nSignal kuchi: ${d.confidence}%\nTarixiy test: ${bt.n} savdo, yutuq ${bt.wr}%, ${bt.exp}R\n\n${d.text}\n\nMoliyaviy maslahat emas. SL ishlating.`);
      sent[key] = Date.now();
    } catch (e) { console.log(sym, tf, e.message); }
  }
  fs.writeFileSync("sent.json", JSON.stringify(sent));
}

// Har 1 daqiqada tekshiradi, taxminan LOOP_MIN daqiqa davomida
const END = Date.now() + Number(process.env.LOOP_MIN || 5) * 60000 - 30000;
while (true) {
  console.log("scan", new Date().toISOString());
  await once();
  if (Date.now() + 60000 > END) break;
  await new Promise((r) => setTimeout(r, 60000));
}
