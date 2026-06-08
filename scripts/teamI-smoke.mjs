import { chromium } from "playwright";
const B = "http://localhost:3013/team-apps/teamI";
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e))); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
const r=[]; let fail=0;
async function step(n,fn){try{await fn();r.push("✅ "+n);}catch(e){fail++;r.push("❌ "+n+" — "+e.message.split("\n")[0]+" @ "+p.url());try{await p.screenshot({path:`/tmp/teamI-f${r.length}.png`});}catch{}}}

await step("ログイン→ダッシュボード", async()=>{
  await p.goto(`${B}/login.html`); await p.fill("#staffId","10001"); await p.fill("#password","password123");
  await p.click(".btn-primary"); await p.waitForURL("**/dashboard.html",{timeout:6000});
  await p.waitForSelector("#arrivalBody tr");
});
await step("在庫管理：検索結果に行", async()=>{
  await p.click('.navbar-nav a[href="./stocks.html"]'); await p.waitForURL("**/stocks.html");
  await p.waitForSelector("#tbody tr"); const n=await p.locator("#tbody tr").count();
  if(n<1) throw new Error("rows="+n);
  const txt=await p.textContent("#tbody"); if(!txt.includes("9784")) throw new Error("no isbn");
});
await step("在庫：タイトル検索で絞り込み", async()=>{
  await p.fill('input[name="title"]',"容疑者"); await p.click('button[type="submit"]');
  await p.waitForTimeout(200); const txt=await p.textContent("#tbody");
  if(!txt.includes("容疑者X")) throw new Error("search miss");
});
await step("取り寄せ予約：出荷/入荷タブ", async()=>{
  await p.click('.navbar-nav a[href="./orders.html"]'); await p.waitForURL("**/orders.html");
  await p.waitForSelector("#shippingBody"); 
  await p.click("#tabPickup"); await p.waitForTimeout(150);
  const active=await p.locator("#pickup.active").count(); if(active!==1) throw new Error("tab switch fail");
});
await step("POP管理：店員POP/お客様POP表示", async()=>{
  await p.click('.navbar-nav a[href="./pops.html"]'); await p.waitForURL("**/pops.html");
  await p.waitForSelector("#staffBody tr");
  const sc=await p.textContent("#staffCount"); const cc=await p.textContent("#customerCount");
  if(!sc.includes("件")||!cc.includes("件")) throw new Error("counts missing");
});
await step("店員管理：一覧に行(管理者)", async()=>{
  await p.click('.navbar-nav a[href="./staffs.html"]'); await p.waitForURL("**/staffs.html");
  await p.waitForSelector("#tbody tr"); const n=await p.locator("#tbody tr").count();
  if(n<1) throw new Error("rows="+n);
});
await step("POP掲示板：店員/お客様カード表示", async()=>{
  await p.goto(`${B}/board.html`); await p.waitForSelector(".pop-card");
  const n=await p.locator(".pop-card").count(); if(n<1) throw new Error("cards="+n);
});
await step("POP詳細へ遷移し書籍・在庫表示", async()=>{
  await p.click(".pop-card"); await p.waitForURL("**/board-detail.html**");
  await p.waitForSelector(".stock-list"); const t=await p.textContent(".info-card");
  if(!t.includes("書籍タイトル")) throw new Error("no detail");
});
await step("コメント投稿でlocalStorage追加", async()=>{
  const before=await p.locator(".comment-item").count();
  await p.fill('textarea[name="content"]',"テストコメント投稿");
  p.once("dialog",d=>d.accept());
  await p.click(".btn-submit"); await p.waitForTimeout(300);
  const after=await p.locator(".comment-item").count();
  if(after < before+1) throw new Error(before+"->"+after);
});
await step("JSエラーなし", async()=>{ if(errs.length) throw new Error(errs.slice(0,3).join(" | ")); });

console.log("\n==== teamI 通し検証 ====");
r.forEach(x=>console.log(x));
console.log(fail===0?"ALL PASS":fail+" FAILED");
await b.close(); process.exit(fail?1:0);
