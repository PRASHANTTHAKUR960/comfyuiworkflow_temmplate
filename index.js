import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "https://comfy.org/workflows/";
const DOWNLOAD_DIR = path.join(process.cwd(), "workflows");

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

(async () => {

    const browser = await chromium.launch({
        headless: false
    });

    const context = await browser.newContext({
        acceptDownloads: true
    });

    const page = await context.newPage();

    console.log("Opening website...");
    await page.goto(BASE_URL, {
        waitUntil: "networkidle"
    });

    console.log("Loading all workflows...");

    let previousHeight = 0;

    while (true) {

        const currentHeight = await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            return document.body.scrollHeight;
        });

        if (currentHeight === previousHeight)
            break;

        previousHeight = currentHeight;

        await page.waitForTimeout(2000);
    }

    console.log("Collecting workflow links...");

    const links = await page.$$eval(
        'a[href^="/workflows/"]',
        anchors => [...new Set(
            anchors.map(a => "https://comfy.org" + a.getAttribute("href"))
        )]
    );

    console.log(`Found ${links.length} workflows`);

    for (let i = 0; i < links.length; i++) {

        const url = links[i];

        console.log(`[${i + 1}/${links.length}] ${url}`);

        const workflowPage = await context.newPage();

        await workflowPage.goto(url, {
            waitUntil: "networkidle"
        });

        try {

            const downloadPromise = workflowPage.waitForEvent("download");

            await workflowPage.getByRole("button", {
                name: /download/i
            }).click();

            const download = await downloadPromise;

            const filename = await download.suggestedFilename();

            await download.saveAs(
                path.join(DOWNLOAD_DIR, filename)
            );

            console.log("Downloaded:", filename);

        } catch (err) {

            console.log("Failed:", url);

        }

        await workflowPage.close();

    }

    await browser.close();

})();
