import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [path, target] of [["/companies", "/companies?q=harbour"], ["/companies?q=harbour", "/companies"], ["/companies/demo-kola-pay", "/companies/demo-kola-pay?sort=lowest"]]) {
  let ok = 0;
  for (let i = 0; i < 8; i++) {
    const p = await b.newPage();
    await p.goto("http://localhost:3100" + path);
    await p.waitForTimeout(400);
    await p.evaluate((t) => window.next.router.push(t), target);
    await p.waitForTimeout(1500);
    if (p.url().endsWith(target)) ok++;
    await p.close();
  }
  console.log(path, "->", target, ok, "/ 8");
}
await b.close();
