const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json({ limit: "10mb" })); // html이 길어질 수 있어서 넉넉히

// Railway가 살아있는지 확인하는 엔드포인트
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// (예시) HTML을 받아서 4:5(1080x1350) PNG로 렌더링해서 반환
app.post("/render", async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: "html is required" });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // ✅ 4:5 비율 = 1080 x 1350
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pngBuffer = await page.screenshot({ type: "png" });

    res.setHeader("Content-Type", "image/png");
    res.status(200).send(pngBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  } finally {
    if (browser) await browser.close();
  }
});

// ✅ Railway는 PORT 환경변수로 포트를 줌. 이걸 반드시 써야 함.
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
