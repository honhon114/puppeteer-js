const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let isRunning = false;

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.post("/run", async (req, res) => {
  if (isRunning) {
    return res.status(429).json({ ok: false, error: "already running" });
  }

  isRunning = true;
  let browser;

  try {
    console.log("Starting browser...");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    console.log("Navigating to website...");
    await page.goto("https://railway.com", { waitUntil: "networkidle2" });

    const title = await page.title();
    const heading = await page.$eval("h1", (el) => el.textContent);

    console.log("Page title:", title);
    console.log("Main heading:", heading);

    res.json({ ok: true, title, heading });
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({ ok: false, error: String(error) });
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
    isRunning = false;
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
