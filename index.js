const express = require("express");
const puppeteer = require("puppeteer");
const archiver = require("archiver");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Railway는 PORT 환경변수를 줍니다. 로컬은 8080로.
const PORT = process.env.PORT || 8080;

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

/**
 * POST /render
 * body 예시:
 * {
 *   "title": "오늘의 주제",
 *   "subtitle": "짧은 설명",
 *   "page1": { "bg": "#111827", "accent": "#a855f7" },
 *   "page2": { "bg": "#0b1220", "accent": "#22c55e" }
 * }
 */
app.post("/render", async (req, res) => {
  let browser;

  try {
    const payload = req.body || {};
    const title = payload.title || "제목";
    const subtitle = payload.subtitle || "부제목";
    const page1 = payload.page1 || { bg: "#111827", accent: "#a855f7" };
    const page2 = payload.page2 || { bg: "#0b1220", accent: "#22c55e" };

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // ✅ 4:5 (1080x1350)
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

    // 2장 만들기
    const img1 = await renderCard(page, {
      title,
      subtitle,
      ...page1,
      variant: 1,
    });

    const img2 = await renderCard(page, {
      title,
      subtitle,
      ...page2,
      variant: 2,
    });

    // ✅ zip으로 묶어서 반환
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="cards.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    archive.append(img1, { name: "card-1.png" });
    archive.append(img2, { name: "card-2.png" });

    await archive.finalize();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  } finally {
    if (browser) await browser.close();
  }
});

// 카드 1장 렌더링: HTML을 만든 뒤 스크린샷
async function renderCard(page, opts) {
  const { title, subtitle, bg, accent, variant } = opts;

  // ✅ 두 장 디자인 다르게: variant로 레이아웃 변경
  const html = buildHtml({ title, subtitle, bg, accent, variant });

  // setContent로 외부 사이트 접속 없이 바로 렌더링
  await page.setContent(html, { waitUntil: "networkidle0" });

  // 폰트/레이아웃 안정화를 위해 잠깐 대기(짧게)
  await page.waitForTimeout(200);

  // 전체 페이지 스크린샷(뷰포트 그대로 1080x1350)
  const buf = await page.screenshot({ type: "png", fullPage: false });
  return buf;
}

function buildHtml({ title, subtitle, bg, accent, variant }) {
  // variant 1: 큰 제목 + 하단 카드
  // variant 2: 좌측 라인 + 가운데 박스
  const layout = variant === 1
    ? `
      <div class="wrap v1">
        <div class="badge">CARD 01</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="sub">${escapeHtml(subtitle)}</p>
        <div class="footer">
          <div class="chip">핵심 1</div>
          <div class="chip">핵심 2</div>
          <div class="chip">핵심 3</div>
        </div>
      </div>
    `
    : `
      <div class="wrap v2">
        <div class="side"></div>
        <div class="center">
          <div class="badge">CARD 02</div>
          <h1>${escapeHtml(title)}</h1>
          <p class="sub">${escapeHtml(subtitle)}</p>
          <div class="box">
            <div class="row">• 포인트 A</div>
            <div class="row">• 포인트 B</div>
            <div class="row">• 포인트 C</div>
          </div>
        </div>
      </div>
    `;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; width:1080px; height:1350px; overflow:hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif;
      background: ${bg};
      color: #fff;
    }
    .wrap { position:relative; width:1080px; height:1350px; padding: 90px 80px; }
    .badge {
      display:inline-block;
      padding: 10px 16px;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      font-size: 18px;
      letter-spacing: .5px;
      opacity: .9;
    }
    h1 { margin: 40px 0 18px; font-size: 72px; line-height: 1.1; }
    .sub { margin: 0; font-size: 28px; line-height: 1.5; color: rgba(255,255,255,.78); }

    /* variant 1 */
    .v1 h1 { max-width: 900px; }
    .footer {
      position:absolute;
      left:80px; right:80px; bottom:90px;
      display:flex; gap:14px; flex-wrap:wrap;
    }
    .chip {
      padding: 14px 18px;
      border-radius: 18px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      font-size: 22px;
    }

    /* variant 2 */
    .v2 { display:flex; gap:40px; }
    .v2 .side {
      width: 18px; border-radius: 999px;
      background: ${accent};
      box-shadow: 0 0 30px rgba(0,0,0,.35);
    }
    .v2 .center { flex:1; }
    .v2 h1 { margin-top: 28px; }
    .box {
      margin-top: 44px;
      padding: 34px 32px;
      border-radius: 26px;
      background: rgba(0,0,0,.22);
      border: 1px solid rgba(255,255,255,.10);
    }
    .row {
      font-size: 28px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .row:last-child { border-bottom:none; }

    /* accent underline */
    h1 {
      background: linear-gradient(180deg, #fff 0%, #fff 60%, ${accent} 60%, ${accent} 78%, transparent 78%);
      display:inline;
      padding-bottom: 8px;
    }
  </style>
</head>
<body>
  ${layout}
</body>
</html>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
