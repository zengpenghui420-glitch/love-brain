#!/usr/bin/env node
// Local checks only. Synthetic ids. The order API host and mantledb.sh are pinned
// to 127.0.0.1 so a missed mock cannot redeem a real order or a real code.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

function loadPuppeteer() {
  const local = createRequire(import.meta.url);
  try { return local('puppeteer-core'); } catch (e) {}
  const pkg = '/tmp/ppt/package.json';
  if (fs.existsSync(pkg)) return createRequire(pkg)('puppeteer-core');
  throw new Error('puppeteer-core is not installed');
}
const puppeteer = loadPuppeteer();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const API = 'https://snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app';
const API_HOST = 'snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app';
const ORDER = 'P847291038475610293';
const OTHER = 'P564738291056473829';
const CODE = 'LB2345';
const REPEAT = 'P111111111111111111';
const SEQUENCE = 'P123456789012345678';
const P19 = 'P9900000000000001378';

function patternError(id) {
  if (!/^P\d{18}$/.test(id)) return 'shape';
  const d = id.slice(1);
  for (const size of [1, 2, 3, 6, 9]) {
    if (d.slice(0, size).repeat(d.length / size) === d) return 'repeat';
  }
  const step = (d.charCodeAt(1) - d.charCodeAt(0) + 10) % 10;
  if (step === 1 || step === 9) {
    let seq = true;
    for (let i = 1; i < d.length; i++) {
      if ((d.charCodeAt(i) - d.charCodeAt(i - 1) + 10) % 10 !== step) seq = false;
    }
    if (seq) return 'sequence';
  }
  return '';
}
if (patternError(ORDER) || patternError(OTHER)) throw new Error('synthetic order is not a legal id');
if (patternError(REPEAT) !== 'repeat') throw new Error('repeat fixture');
if (patternError(SEQUENCE) !== 'sequence') throw new Error('sequence fixture');
if (P19.length !== 20 || /^P\d{18}$/.test(P19)) throw new Error('19-digit fixture');
if (!/^LB[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(CODE)) throw new Error('synthetic code shape');

const script = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
fs.writeFileSync('/tmp/love-brain-script.js', script);
const check = spawnSync(process.execPath, ['--check', '/tmp/love-brain-script.js'], { encoding: 'utf8' });
if (check.status !== 0) {
  console.error(check.stderr || check.stdout);
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class Book {
  constructor() {
    this.codeUses = 0;
    this.codeMode = 'ok';
    this.calls = [];
  }
  reset() { this.codeUses = 0; this.codeMode = 'ok'; this.calls = []; }
  posts(pathname) { return this.calls.filter(c => c.method === 'POST' && c.path === pathname); }
  gets(pathname) { return this.calls.filter(c => c.method === 'GET' && c.path === pathname); }
  handle(method, url, rawBody) {
    const u = new URL(url);
    let body = null;
    if (rawBody) { try { body = JSON.parse(rawBody); } catch (e) { body = null; } }
    const pathName = u.pathname;
    const rec = {
      method,
      path: pathName,
      body,
      quiz: (body && body.quiz) || u.searchParams.get('quiz'),
      orderId: (body && body.orderId) || u.searchParams.get('orderId'),
      code: (body && body.code) || u.searchParams.get('code'),
      url
    };
    this.calls.push(rec);
    if (u.origin !== API || pathName.startsWith('/order') || pathName.includes('/orders/')) {
      rec.unexpected = true;
      return { abort: true };
    }
    if (pathName === '/get') return this.peekCode(u.searchParams.get('code'));
    if (pathName === '/redeem') return this.redeemCode(body && body.code);
    rec.unexpected = true;
    return { abort: true };
  }
  peekCode(code) {
    if (code !== CODE) return { status: 404, body: { ok: false, error: 'not_found' } };
    return { status: 200, body: { ok: true, remaining: Math.max(0, 3 - this.codeUses), max: 3, quiz: 'love' } };
  }
  redeemCode(code) {
    if (this.codeMode === 'drop') return { abort: true };
    if (code !== CODE || this.codeMode === 'miss') return { status: 404, body: { ok: false, error: 'not_found' } };
    if (this.codeMode === 'exhausted' || this.codeUses >= 3) {
      return { status: 403, body: { ok: false, error: 'exhausted', remaining: 0, max: 3 } };
    }
    this.codeUses += 1;
    return { status: 200, body: { ok: true, remaining: 3 - this.codeUses, max: 3, quiz: 'love' } };
  }
}

function staticContract() {
  assert(HTML.includes("const API_BASE='https://snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app'"), 'API_BASE');
  assert(HTML.includes("const QUIZ_KEY='love'"), 'quiz key');
  assert(HTML.includes("const ORDER_USES_KEY='love_brain_order_uses'"), 'quiz-specific use key');
  assert(!HTML.includes('soft_persimmon_order_uses'), 'do not reuse the other quiz key');
  assert(HTML.includes("API_BASE+'/redeem'"), 'legacy redeem path');
  assert(HTML.includes("API_BASE+'/get?quiz='"), 'legacy get path');
  assert(!HTML.includes('/order/redeem') && !HTML.includes('/order/get'), 'no order API');
  assert(!HTML.includes('mantledb'), 'this quiz does not call Mantle');
  assert(!HTML.includes('tmp.now'), 'old preview host removed');
  assert(!HTML.includes('验证码'), 'page must not advertise codes');
  assert(!HTML.includes('付款') && !HTML.includes('支付'), 'no payment-verification copy');
  assert(HTML.includes('paidVerified:false') && !HTML.includes('paidVerified:true') && !HTML.includes('paidVerified: true'), 'paidVerified stays false');
  assert(!HTML.includes('暂时验证不了'), 'format-valid ids are not turned away');
  assert(!HTML.includes('这个订单号的 3 次已经用完了'), 'format-valid ids are not exhausted');
  assert(HTML.includes('次数已经用完了'), 'exhausted access codes still say so');
  assert(!HTML.includes('只存在这台') && !HTML.includes('cosmetic') && !HTML.includes('假的'), 'do not describe the count as local-only');
  assert(!HTML.includes('love-brain') || HTML.includes('github.io/love-brain/'), 'repo name is not the quiz key');
  assert(!HTML.includes("quiz:'love-brain'") && !HTML.includes('quiz=love-brain'), 'quiz must not be the repo slug');
  assert(HTML.includes('输入订单号'), 'order title');
  assert(HTML.includes('到小红书「我的订单」复制订单号贴过来'), 'xiaohongshu copy');
  assert(HTML.includes('每个订单号可以测 3 次'), 'three uses');
  assert(HTML.includes('恋爱脑测试') && HTML.includes('滤镜厚度') && HTML.includes('非正式心理测量'), 'product copy kept');
  assert((HTML.match(/dim:'/g) || []).length === 18, '18 questions kept');
}

function assertNoOrderNet(book, msg) {
  const bad = book.calls.filter(c => c.unexpected || (c.path && (c.path.startsWith('/order') || c.path.includes('/orders/') || String(c.url || '').includes('mantledb'))));
  assert(bad.length === 0, msg + ' ' + JSON.stringify(bad));
}

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(HTML);
        return;
      }
      res.writeHead(404).end('no');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function boot(browser, server, book) {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.setCacheEnabled(false);
  await page.evaluateOnNewDocument(() => {
    globalThis.__LOVE_FINISH_MS = 0;
    globalThis.__LOVE_PICK_MS = 0;
    try {
      if (!sessionStorage.getItem('__test_ready')) {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('__test_ready', '1');
      }
    } catch (e) {}
  });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (req.method() === 'OPTIONS') {
      req.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Device-Id,X-Fingerprint'
        }
      }).catch(() => {});
      return;
    }
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { host = ''; }
    if (url.startsWith(API) || host === 'mantledb.sh' || url.includes('/orders/')) {
      const result = book.handle(req.method(), url, req.postData());
      if (result.abort) {
        req.abort('failed').catch(() => {});
        return;
      }
      req.respond({
        status: result.status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(result.body)
      }).catch(() => {});
      return;
    }
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:')) {
      req.continue().catch(() => {});
      return;
    }
    book.calls.push({ method: req.method(), path: url, url, unexpected: true });
    req.abort('blockedbyclient').catch(() => {});
  });
  page.__errors = errors;
  page.__origin = 'http://127.0.0.1:' + server.address().port;
  return page;
}

async function openHome(page, query) {
  await page.goto(page.__origin + '/' + (query || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof redeemOrder === 'function' && typeof redeemVault === 'function');
  await page.waitForSelector('#btnStart');
}

async function submit(page, value) {
  await page.click('#btnStart');
  await page.waitForSelector('#codeMask.show');
  await page.$eval('#codeInput', (el, v) => { el.value = v; }, value);
  await page.click('#btnCodeOk');
}

async function clearToast(page) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
}

async function waitQuiz(page) {
  await page.waitForSelector('#quiz.active', { timeout: 4000 });
  await page.waitForFunction(() => document.getElementById('qprog').textContent.startsWith('1 '));
}

async function shownUses(page, orderId = ORDER) {
  return page.evaluate(id => shownOrderUses(id), orderId);
}

async function answerOne(page) {
  const before = await page.$eval('#qprog', el => el.textContent);
  await page.click('#opts .opt');
  await page.waitForFunction(prev => document.getElementById('qprog').textContent !== prev, {}, before);
}

async function answerAll(page) {
  for (let i = 1; i <= 18; i++) {
    await page.waitForFunction(n => document.getElementById('qprog').textContent.startsWith(n + ' '), {}, String(i));
    await page.click('#opts .opt');
  }
  await page.waitForSelector('#result.active', { timeout: 4000 });
}

async function fastFinish(page) {
  await page.evaluate(() => {
    for (let i = 0; i < QS.length; i++) ans[i] = 3;
    qi = QS.length - 1;
    finish();
  });
  await page.waitForSelector('#result.active', { timeout: 4000 });
}

async function main() {
  staticContract();
  const passed = [];
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--host-resolver-rules=MAP ${API_HOST} 127.0.0.1, MAP mantledb.sh 127.0.0.1`
    ]
  });
  const book = new Book();
  try {
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      const out = await page.evaluate((order, other, code) => {
        const first = redeemOrder(order);
        const second = redeemOrder(order);
        const third = redeemOrder(order);
        const fourth = redeemOrder(order);
        const repeat = redeemOrder('P111111111111111111');
        const seq = redeemOrder('P123456789012345678');
        const p19 = redeemOrder('P9900000000000001378');
        const otherRes = redeemOrder(other);
        return {
          good: orderFormatError(order),
          repeatErr: orderFormatError('P111111111111111111'),
          seqErr: orderFormatError('P123456789012345678'),
          p19Err: orderFormatError('P9900000000000001378'),
          p19Type: classifyInput('P9900000000000001378').type,
          pasted: classifyInput(' 「p8472-9103-8475-610293」 '),
          code: classifyInput(' lb 23 45 '),
          junk: classifyInput('hello'),
          shortP: classifyInput('P12345'),
          quiz: QUIZ_KEY,
          key: ORDER_USES_KEY,
          stored: localStorage.getItem(ORDER_USES_KEY),
          foreign: localStorage.getItem('soft_persimmon_order_uses'),
          first, second, third, fourth, repeat, seq, p19, otherRes,
          orderUses: shownOrderUses(order),
          otherUses: shownOrderUses(other),
          repeatUses: shownOrderUses('P111111111111111111'),
          copy1: orderSuccessText(first),
          copy2: orderSuccessText(second),
          copy3: orderSuccessText(third),
          copy4: orderSuccessText(fourth),
          codeCopy: orderSuccessText({ ok: true, remaining: 2, max: 3 }),
          paid: first.paidVerified
        };
      }, ORDER, OTHER, CODE);
      assert(out.good === '' && out.pasted.type === 'order' && out.pasted.orderId === ORDER, 'legal id ' + JSON.stringify(out.pasted));
      assert(out.repeatErr === 'invalid' && out.seqErr === 'invalid' && out.p19Err === 'invalid', 'pattern checks');
      assert(out.p19Type === 'order-invalid', '19-digit classifier ' + out.p19Type);
      assert(out.code.type === 'code' && out.code.code === CODE, 'spaced code ' + JSON.stringify(out.code));
      assert(out.junk.type === 'order-invalid' && out.shortP.type === 'order-invalid', 'junk classifier');
      assert(out.quiz === 'love' && out.key === 'love_brain_order_uses', 'constants');
      assert(out.foreign == null, 'foreign key was written');
      assert(out.first.ok && out.first.uses === 1 && out.first.remaining === 2 && out.first.paidVerified === false, JSON.stringify(out.first));
      assert(out.copy1 === '验证成功，还可以测 2 次', out.copy1);
      assert(out.copy2 === '验证成功，还可以测 1 次', out.copy2);
      assert(out.copy3 === '验证成功，这是最后一次', out.copy3);
      assert(out.copy4 === '验证成功', out.copy4);
      assert(out.fourth.uses === 4 && out.orderUses === 4, 'fourth display count');
      assert(out.otherRes.uses === 1 && out.otherUses === 1 && out.orderUses === 4, 'counts are per order id');
      assert(out.repeat.ok === false && out.seq.ok === false && out.p19.ok === false && out.repeatUses === 0, 'bad ids do not count');
      assert(out.codeCopy === '验证成功，还可以测 2 次', 'code toast changed ' + out.codeCopy);
      assert(out.paid === false, 'paidVerified');
      const map = JSON.parse(out.stored);
      assert(map[ORDER] === 4 && map[OTHER] === 1 && Object.keys(map).length === 2, 'stored map ' + out.stored);
      assertNoOrderNet(book, 'format checks must not call the network');
      assert(book.calls.length === 0, 'format checks called the network ' + JSON.stringify(book.calls));
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      await page.close();
      passed.push('格式与分订单号计数');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await openHome(page);
      const visible = await page.evaluate(() => document.body.innerText);
      assert(visible.includes('恋爱脑测试') && !visible.includes('验证码') && !visible.includes('paidVerified') && !visible.includes('付款'), 'start copy');
      await submit(page, ' 「p8472-9103-8475-610293」 ');
      await waitQuiz(page);
      assert(await shownUses(page) === 1, 'first start should display one use');
      const toast = await page.$eval('#toast', el => el.textContent);
      assert(toast === '验证成功，还可以测 2 次', toast);
      assertNoOrderNet(book, 'first start');
      assert(book.calls.length === 0, 'first start called the network');
      const q = await page.$eval('#qtext', el => el.textContent);
      await answerOne(page);
      await answerOne(page);
      const mid = await page.$eval('#qtext', el => el.textContent);
      const prog = await page.$eval('#qprog', el => el.textContent);
      assert(prog === '3 / 18', prog);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#quiz.active', { timeout: 4000 });
      assert((await page.$eval('#qtext', el => el.textContent)) === mid, 'mid refresh keeps the question');
      assert(await shownUses(page) === 1, 'refresh changed the display count');
      assertNoOrderNet(book, 'refresh');
      await page.click('#qback');
      await page.click('#qback');
      await page.click('#qback');
      await page.waitForSelector('#start.active');
      await page.click('#btnStart');
      await waitQuiz(page);
      assert((await page.$eval('#qtext', el => el.textContent)) === q, 'continue restores the first question');
      const cont = await page.evaluate(() => ({
        prog: document.getElementById('qprog').textContent,
        sel: document.querySelectorAll('#opts .opt.sel').length
      }));
      assert(cont.prog === '1 / 18' && cont.sel === 1, 'continue ' + JSON.stringify(cont));
      assert(await shownUses(page) === 1, 'continue changed the display count');
      assertNoOrderNet(book, 'continue');
      await answerAll(page);
      const title = await page.$eval('#typeTitle', el => el.textContent);
      const index = await page.$eval('.index-num', el => el.textContent);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#result.active', { timeout: 4000 });
      assert((await page.$eval('#typeTitle', el => el.textContent)) === title, 'result refresh keeps the result');
      assert((await page.$eval('.index-num', el => el.textContent)) === index, 'result refresh keeps the index');
      assert(await shownUses(page) === 1, 'result refresh changed the display count');
      assertNoOrderNet(book, 'result refresh');
      await page.click('#btnViewLast');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('不扣次'));
      assert(await shownUses(page) === 1, '查看上次 changed the display count');
      await page.evaluate(() => show('start'));
      await page.click('#btnLast');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('不扣次'));
      assert((await page.$eval('#btnLast', el => el.textContent)) === '查看上次结果', 'button label');
      assert(await shownUses(page) === 1, '查看上次结果 changed the display count');
      assertNoOrderNet(book, 'view last');

      await page.click('#btnRetry');
      await page.waitForSelector('#start.active');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('还可以测 1 次'));
      assert(await shownUses(page) === 2, 'retest should display the second use');
      await page.click('#btnStart');
      await waitQuiz(page);
      assert(await shownUses(page) === 2, 'entering after retest changed the display count');
      await fastFinish(page);
      await page.click('#btnRetry');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('这是最后一次'));
      assert(await shownUses(page) === 3, 'third displayed use');
      await page.click('#btnStart');
      await waitQuiz(page);
      await fastFinish(page);
      await page.click('#btnRetry');
      await page.waitForFunction(() => document.getElementById('toast').textContent === '验证成功');
      const afterRetry = await page.evaluate(id => ({
        start: document.getElementById('start').classList.contains('active'),
        quiz: document.getElementById('quiz').classList.contains('active'),
        toast: document.getElementById('toast').textContent,
        uses: shownOrderUses(id)
      }), ORDER);
      assert(afterRetry.start && !afterRetry.quiz, 'later retest should not block on the result ' + JSON.stringify(afterRetry));
      assert(afterRetry.toast === '验证成功' && !afterRetry.toast.includes('用完') && !afterRetry.toast.includes('暂时验证不了'), afterRetry.toast);
      assert(afterRetry.uses === 4, 'later entry records a display count');
      await page.click('#btnStart');
      await waitQuiz(page);
      const opened = await page.evaluate(id => ({
        quiz: document.getElementById('quiz').classList.contains('active'),
        prog: document.getElementById('qprog').textContent,
        len: ans.length,
        uses: shownOrderUses(id),
        toast: document.getElementById('toast').textContent
      }), ORDER);
      assert(opened.quiz && opened.prog === '1 / 18' && opened.len === 0, 'later entry must still open ' + JSON.stringify(opened));
      assert(opened.uses === 4 && opened.toast === '验证成功', JSON.stringify(opened));
      assertNoOrderNet(book, 'later entry');
      assert(book.calls.length === 0, 'order flow called the network ' + JSON.stringify(book.calls));

      await page.evaluate(() => { clearUnlock(); show('start'); });
      await submit(page, OTHER);
      await waitQuiz(page);
      assert(await shownUses(page, OTHER) === 1, 'other id should start at one');
      assert(await shownUses(page, ORDER) === 4, 'other id changed the first count');
      const otherToast = await page.$eval('#toast', el => el.textContent);
      assert(otherToast === '验证成功，还可以测 2 次', otherToast);
      assertNoOrderNet(book, 'other id');
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      await page.close();
      passed.push('首次/刷新/继续/上次结果/再测/仍可进入');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      for (const value of [REPEAT, P19, SEQUENCE, 'hello']) {
        await clearToast(page);
        if (value === REPEAT) await submit(page, value);
        else {
          await page.$eval('#codeInput', (el, v) => { el.value = v; }, value);
          await page.click('#btnCodeOk');
        }
        await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
        const onQuiz = await page.$eval('#quiz', el => el.classList.contains('active'));
        const unlocked = await page.evaluate(() => isUnlocked());
        assert(!onQuiz && !unlocked, value + ' started the quiz');
      }
      assert(book.calls.length === 0, 'invalid ids called the network ' + JSON.stringify(book.calls));
      assert(await shownUses(page, REPEAT) === 0, 'rejected id stored a count');
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      await page.close();
      passed.push('19位/重复/序列在本地拒绝');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      await submit(page, CODE);
      await waitQuiz(page);
      const posts = book.posts('/redeem');
      assert(posts.length === 1, 'legacy redeem once, got ' + posts.length);
      assert(posts[0].body.quiz === 'love' && posts[0].body.code === CODE && !('orderId' in posts[0].body), 'legacy body ' + JSON.stringify(posts[0].body));
      assert(book.posts('/order/redeem').length === 0 && book.gets('/order/get').length === 0, 'code used the order API');
      assertNoOrderNet(book, 'code redeem');
      const codeToast = await page.$eval('#toast', el => el.textContent);
      assert(codeToast === '验证成功，还可以测 2 次', codeToast);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start.active');
      assert(book.posts('/redeem').length === 1, 'code refresh redeemed again');
      await page.click('#btnStart');
      await waitQuiz(page);
      assert(book.posts('/redeem').length === 1, 'code continue redeemed again');
      await page.evaluate(code => peekVault(code), CODE);
      const gets = book.gets('/get');
      assert(gets.length === 1 && gets[0].quiz === 'love' && gets[0].code === CODE, 'legacy peek ' + JSON.stringify(gets));
      assertNoOrderNet(book, 'code peek');
      await page.close();
      const linked = await boot(browser, server, book);
      await linked.goto(linked.__origin + '/?code=' + CODE, { waitUntil: 'domcontentloaded' });
      await linked.waitForSelector('#codeMask.show');
      assert((await linked.$eval('#codeInput', el => el.value)) === CODE, 'legacy link prefills');
      assert(book.posts('/redeem').length === 1, 'legacy link redeemed by itself');
      const orderLink = await boot(browser, server, book);
      await orderLink.goto(orderLink.__origin + '/?code=' + ORDER, { waitUntil: 'domcontentloaded' });
      await orderLink.waitForSelector('#start.active');
      const orderLinked = await orderLink.evaluate(id => ({
        quiz: document.getElementById('quiz').classList.contains('active'),
        uses: shownOrderUses(id)
      }), ORDER);
      assert(!orderLinked.quiz && orderLinked.uses === 0, 'query order auto-started ' + JSON.stringify(orderLinked));
      assert(book.calls.length === gets.length + posts.length, 'query order called the network ' + JSON.stringify(book.calls));
      await linked.close();
      await orderLink.close();
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      passed.push('旧码仍走 vault');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      book.codeMode = 'miss';
      await submit(page, CODE);
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('订单号不对'));
      assert(await page.$eval('#quiz', el => !el.classList.contains('active')), 'vault miss opened the quiz');
      assert(book.posts('/redeem').length === 1, 'vault miss did not call /redeem');
      assertNoOrderNet(book, 'vault miss');
      await page.close();
      book.reset();
      const exhausted = await boot(browser, server, book);
      await openHome(exhausted);
      book.codeMode = 'exhausted';
      await submit(exhausted, CODE);
      await exhausted.waitForFunction(() => document.getElementById('toast').textContent.includes('次数已经用完'));
      assert(await exhausted.$eval('#quiz', el => !el.classList.contains('active')), 'exhausted code opened the quiz');
      assert(book.posts('/redeem').length === 1 && book.codeUses === 0, 'exhausted code still incremented');
      assertNoOrderNet(book, 'exhausted code');
      await exhausted.close();
      passed.push('vault 未命中与用完不落到别的计数');
    }
    book.reset();
    {
      for (const width of [320, 390]) {
        const page = await boot(browser, server, book);
        await page.setViewport({ width, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await openHome(page);
        await page.click('#btnStart');
        await page.waitForSelector('#codeMask.show');
        await page.$eval('#codeInput', (el, v) => { el.value = v; }, ORDER);
        const box = await page.evaluate(() => {
          const panel = document.querySelector('.code-panel');
          const input = document.getElementById('codeInput');
          const r = panel.getBoundingClientRect();
          return {
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
            panelRight: r.right,
            panelLeft: r.left,
            inputScroll: input.scrollWidth,
            inputClient: input.clientWidth,
            title: document.querySelector('.code-panel h3').textContent,
            copy: document.querySelector('.code-copy').innerText,
            placeholder: input.placeholder
          };
        });
        assert(box.scroll <= box.client + 1, width + ' modal page overflows');
        assert(box.panelLeft >= -1 && box.panelRight <= box.client + 1, width + ' panel overflows');
        assert(box.inputScroll <= box.inputClient + 1, width + ' order id overflows the input');
        assert(box.title === '输入订单号', 'title ' + box.title);
        assert(box.copy.includes('小红书「我的订单」') && box.copy.includes('3 次'), 'copy ' + box.copy);
        assert(box.placeholder === '订单号', 'placeholder');
        assert(book.calls.length === 0, 'opening the form called the network');
        await page.close();
      }
      passed.push('手机 320 与 390');
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(JSON.stringify({ ok: true, passed }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
