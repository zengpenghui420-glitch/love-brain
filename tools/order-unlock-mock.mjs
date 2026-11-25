#!/usr/bin/env node
// Local mock only. Never calls the live order API and never uses a real order or a real code.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const API = 'https://snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app';
const ORDER = 'P810901623715068081';
const CODE = 'LB2345';
const shots = path.resolve('/tmp/love-order-shots');
fs.mkdirSync(shots, {recursive: true});

const script = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
fs.writeFileSync('/tmp/love-brain-script.js', script);
const check = spawnSync(process.execPath, ['--check', '/tmp/love-brain-script.js'], {encoding: 'utf8'});
if (check.status !== 0) {
  console.error(check.stderr || check.stdout);
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function pathnameOf(url) {
  return new URL(url).pathname;
}

class Book {
  constructor() {
    this.uses = 0;
    this.max = 3;
    this.bound = null;
    this.postMode = 'ok';
    this.codeUses = 0;
    this.calls = [];
  }
  reset() { this.uses = 0; this.bound = null; this.postMode = 'ok'; this.codeUses = 0; this.calls = []; }
  posts(pathname) { return this.calls.filter(c => c.method === 'POST' && c.path === pathname); }
  gets(pathname) { return this.calls.filter(c => c.method === 'GET' && c.path === pathname); }
  orderBody(uses) {
    const remaining = Math.max(0, this.max - uses);
    return {ok: true, remaining, max: this.max, uses, quiz: 'love', orderId: ORDER, bound: true, paidVerified: false};
  }
  handle(method, url, rawBody) {
    const u = new URL(url);
    if (u.origin !== API) {
      this.calls.push({method, path: u.pathname, unexpected: true, url});
      return {status: 404, body: {ok: false, error: 'unexpected'}};
    }
    let body = null;
    if (rawBody) { try { body = JSON.parse(rawBody); } catch (e) { body = null; } }
    const pathName = u.pathname;
    const rec = {method, path: pathName, body, quiz: body && body.quiz || u.searchParams.get('quiz'), orderId: body && body.orderId || u.searchParams.get('orderId'), code: body && body.code || u.searchParams.get('code')};
    this.calls.push(rec);
    if (pathName === '/order/get') return this.peek();
    if (pathName === '/order/redeem') return this.redeem();
    if (pathName === '/get') return this.peekCode(u.searchParams.get('code'));
    if (pathName === '/redeem') return this.redeemCode(body && body.code);
    rec.unexpected = true;
    return {status: 404, body: {ok: false, error: 'unexpected'}};
  }
  peek() {
    if (this.bound === 'other') return {status: 403, body: {ok: false, error: 'bound_other_quiz'}};
    if (this.bound !== 'love') return {status: 404, body: {ok: false, error: 'not_found'}};
    return {status: 200, body: this.orderBody(this.uses)};
  }
  redeem() {
    if (this.bound === 'other') return {status: 403, body: {ok: false, error: 'bound_other_quiz'}};
    if (this.bound === 'love' && this.uses >= this.max) {
      return {status: 403, body: {ok: false, error: 'exhausted', remaining: 0, max: this.max}};
    }
    const mode = this.postMode;
    if (mode === 'drop') return {abort: true};
    if (mode === 'drop-once') { this.postMode = 'ok'; return {abort: true}; }
    if (mode === 'commit-drop') {
      this.bound = 'love';
      this.uses += 1;
      this.postMode = 'ok';
      return {abort: true};
    }
    this.bound = 'love';
    this.uses += 1;
    return {status: 200, body: this.orderBody(this.uses)};
  }
  peekCode(code) {
    if (code !== CODE) return {status: 404, body: {ok: false, error: 'not_found'}};
    return {status: 200, body: {ok: true, remaining: Math.max(0, 3 - this.codeUses), max: 3, quiz: 'love'}};
  }
  redeemCode(code) {
    if (code !== CODE) return {status: 404, body: {ok: false, error: 'not_found'}};
    if (this.codeUses >= 3) return {status: 403, body: {ok: false, error: 'exhausted', remaining: 0, max: 3}};
    this.codeUses += 1;
    return {status: 200, body: {ok: true, remaining: 3 - this.codeUses, max: 3, quiz: 'love'}};
  }
}

function staticContract() {
  assert(HTML.includes("const API_BASE='https://snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app'"), 'API_BASE');
  assert(HTML.includes("const QUIZ_KEY='love'"), 'quiz key');
  assert(HTML.includes("API_BASE+'/redeem'"), 'legacy redeem path');
  assert(HTML.includes("API_BASE+'/get?quiz='"), 'legacy get path');
  assert(HTML.includes("API_BASE+'/order/redeem'"), 'order redeem path');
  assert(HTML.includes("API_BASE+'/order/get?quiz='"), 'order get path');
  assert(!HTML.includes('mantledb'), 'legacy must stay off Mantle');
  assert(!HTML.includes('tmp.now'), 'old preview host removed');
  assert(!HTML.includes('验证码'), 'page must not advertise codes');
  assert(!HTML.includes('付款') && !HTML.includes('paidVerified') && !HTML.includes('支付'), 'no payment-verification copy');
  assert(!HTML.includes('love-brain') || HTML.includes('github.io/love-brain/'), 'repo name is not the quiz key');
  assert(!HTML.includes("quiz:'love-brain'") && !HTML.includes('quiz=love-brain'), 'quiz must not be the repo slug');
  assert(HTML.includes('输入订单号'), 'order title');
  assert(HTML.includes('到小红书「我的订单」复制订单号贴过来'), 'xiaohongshu copy');
  assert(HTML.includes('每个订单号可以测 3 次'), 'three uses');
  assert(HTML.includes('恋爱脑测试') && HTML.includes('滤镜厚度') && HTML.includes('非正式心理测量'), 'product copy kept');
  assert((HTML.match(/dim:'/g) || []).length === 18, '18 questions kept');
}

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
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
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.evaluateOnNewDocument(() => {
    globalThis.__LOVE_FINISH_MS = 0;
    globalThis.__LOVE_PICK_MS = 0;
    globalThis.__ORDER_TIMEOUT_MS = 500;
    globalThis.__ORDER_RECONCILE_MS = 0;
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
    if (url.startsWith(API)) {
      const result = book.handle(req.method(), url, req.postData());
      if (result.abort) {
        req.abort('failed').catch(() => {});
        return;
      }
      req.respond({
        status: result.status,
        contentType: 'application/json',
        headers: {'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify(result.body)
      }).catch(() => {});
      return;
    }
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:')) {
      req.continue().catch(() => {});
      return;
    }
    book.calls.push({method: req.method(), path: url, unexpected: true});
    req.abort('blockedbyclient').catch(() => {});
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  page.__errors = errors;
  page.__origin = origin;
  return page;
}

async function openHome(page, query) {
  await page.goto(page.__origin + '/' + (query || ''), {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('#btnStart');
}

async function submit(page, value) {
  await page.click('#btnStart');
  await page.waitForSelector('#codeMask.show');
  await page.$eval('#codeInput', (el, v) => { el.value = v; }, value);
  await page.click('#btnCodeOk');
}

async function waitQuiz(page) {
  await page.waitForSelector('#quiz.active', {timeout: 4000});
  await page.waitForFunction(() => document.getElementById('qprog').textContent.startsWith('1 '));
}

async function answerAll(page) {
  for (let i = 1; i <= 18; i++) {
    await page.waitForFunction(n => document.getElementById('qprog').textContent.startsWith(n + ' '), {}, String(i));
    await page.click('#opts .opt');
  }
  await page.waitForSelector('#result.active', {timeout: 4000});
}

function noSurprise(book) {
  const bad = book.calls.filter(c => c.unexpected || (c.quiz && c.quiz !== 'love') || (c.path.startsWith('/order') && c.orderId && c.orderId !== ORDER));
  assert(bad.length === 0, 'unexpected call ' + JSON.stringify(bad));
}

async function shot(page, name) {
  await page.screenshot({path: path.join(shots, name + '.png'), fullPage: true});
}

async function main() {
  staticContract();
  const passed = [];
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const book = new Book();
  try {
    {
      const page = await boot(browser, server, book);
      await page.setViewport({width: 390, height: 720, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
      await openHome(page);
      await submit(page, 'Ｐ８１０９０１６２３７１５０６８０８１');
      await waitQuiz(page);
      const posts = book.posts('/order/redeem');
      assert(posts.length === 1, 'first attempt posts once, got ' + posts.length);
      assert(posts[0].body.quiz === 'love' && posts[0].body.orderId === ORDER, 'redeem body ' + JSON.stringify(posts[0].body));
      assert(book.posts('/redeem').length === 0, 'order must not use legacy redeem');
      assert(book.uses === 1, 'uses');
      const q = await page.$eval('#qtext', el => el.textContent);
      await page.click('#opts .opt');
      await page.waitForFunction(() => document.getElementById('qprog').textContent.startsWith('2 '));
      const mid = await page.$eval('#qtext', el => el.textContent);
      const postsBeforeReload = book.posts('/order/redeem').length;
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.waitForSelector('#quiz.active', {timeout: 4000});
      const midAfter = await page.$eval('#qtext', el => el.textContent);
      assert(midAfter === mid, 'mid refresh keeps the question');
      assert(book.posts('/order/redeem').length === postsBeforeReload, 'mid refresh must not redeem');
      assert(book.gets('/order/get').length >= 1, 'mid refresh peeks');
      await page.click('#qback');
      await page.waitForFunction(() => document.getElementById('qprog').textContent.startsWith('1 '));
      assert((await page.$eval('#qtext', el => el.textContent)) === q, 'back restores the first question');
      await page.click('#qback');
      await page.waitForSelector('#start.active');
      const postsBeforeContinue = book.posts('/order/redeem').length;
      await page.click('#btnStart');
      await page.waitForSelector('#quiz.active', {timeout: 4000});
      assert(book.posts('/order/redeem').length === postsBeforeContinue, 'continue must not redeem');
      assert((await page.$eval('#qtext', el => el.textContent)) === q, 'continue restores progress');
      await answerAll(page);
      const title = await page.$eval('#typeTitle', el => el.textContent);
      const postsBeforeResult = book.posts('/order/redeem').length;
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.waitForSelector('#result.active', {timeout: 4000});
      assert((await page.$eval('#typeTitle', el => el.textContent)) === title, 'result refresh keeps the result');
      assert(book.posts('/order/redeem').length === postsBeforeResult, 'result refresh must not redeem');
      await page.click('#btnRetry');
      await page.waitForSelector('#start.active', {timeout: 4000});
      assert(book.posts('/order/redeem').length === postsBeforeResult + 1, 'retest redeems once');
      assert(book.uses === 2, 'uses after retest');
      noSurprise(book);
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      await page.close();
      passed.push('首次/中途刷新/继续/结果刷新/再测');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await page.setViewport({width: 390, height: 720});
      await openHome(page);
      await submit(page, ORDER);
      await waitQuiz(page);
      await answerAll(page);
      const title = await page.$eval('#typeTitle', el => el.textContent);
      book.uses = 3;
      const posts = book.posts('/order/redeem').length;
      await page.click('#btnRetry');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('3 次已经用完'));
      assert(documentActive(await page.$eval('#result', el => el.className)), 'result stays up');
      assert((await page.$eval('#typeTitle', el => el.textContent)) === title, 'fourth attempt keeps the result');
      assert(book.uses === 3, 'fourth attempt does not increment');
      assert(book.posts('/order/redeem').length === posts, 'exhausted peek does not redeem');
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.waitForSelector('#result.active', {timeout: 4000});
      assert((await page.$eval('#typeTitle', el => el.textContent)) === title, 'refresh after rejection still shows the result');
      assert(book.posts('/order/redeem').length === posts, 'refresh after rejection does not redeem');
      noSurprise(book);
      await page.close();
      passed.push('第4次拒绝并保留结果');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      book.bound = 'other';
      await submit(page, 'P8109-0162-3715-068081');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('别的测试'));
      assert(await page.$eval('#quiz', el => !el.classList.contains('active')), 'wrong bind does not open the quiz');
      assert(book.posts('/order/redeem').length === 0, 'wrong bind stops before redeem');
      assert(book.uses === 0, 'wrong bind does not increment');
      await page.close();
      passed.push('错绑');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      book.postMode = 'commit-drop';
      await submit(page, ORDER);
      await waitQuiz(page);
      assert(book.posts('/order/redeem').length === 1, 'timeout after commit does not post again');
      assert(book.uses === 1, 'committed use is kept');
      noSurprise(book);
      await page.close();
      passed.push('超时已入账只 peek');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      book.postMode = 'drop-once';
      await submit(page, ORDER);
      await waitQuiz(page);
      assert(book.posts('/order/redeem').length === 2, 'timeout without commit posts one more time');
      assert(book.uses === 1, 'retry increments once');
      await page.close();
      passed.push('超时未入账再扣一次');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      book.postMode = 'drop';
      await submit(page, ORDER);
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('暂时验证不了'));
      assert(book.posts('/order/redeem').length === 2, 'two failed posts then stop');
      assert(book.uses === 0, 'failed posts do not increment');
      assert(await page.$eval('#quiz', el => !el.classList.contains('active')), 'no quiz after timeout');
      await page.close();
      passed.push('超时两次放弃');
    }
    book.reset();
    {
      const page = await boot(browser, server, book);
      await openHome(page);
      await submit(page, 'P111111111111111111');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
      await page.$eval('#codeInput', el => { el.value = '不是订单'; });
      await page.click('#btnCodeOk');
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
      assert(book.calls.length === 0, 'bad orders do not hit the API');
      await page.$eval('#codeInput', (el, v) => { el.value = v; }, CODE);
      await page.click('#btnCodeOk');
      await waitQuiz(page);
      assert(book.posts('/redeem').length === 1, 'legacy redeem once');
      assert(book.posts('/redeem')[0].body.quiz === 'love' && book.posts('/redeem')[0].body.code === CODE, 'legacy body');
      assert(book.posts('/order/redeem').length === 0, 'legacy code must not use order redeem');
      assert(book.posts('/redeem')[0].path === '/redeem', 'legacy path is /redeem');
      const posts = book.posts('/redeem').length;
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.waitForSelector('#start.active');
      assert(book.posts('/redeem').length === posts, 'legacy refresh does not redeem again');
      await page.click('#btnStart');
      await waitQuiz(page);
      assert(book.posts('/redeem').length === posts, 'legacy continue in the same tab does not redeem');
      await page.evaluate(code => peekVault(code), CODE);
      const gets = book.gets('/get');
      assert(gets.length === 1 && gets[0].quiz === 'love' && gets[0].code === CODE, 'legacy peek is GET /get ' + JSON.stringify(gets));
      noSurprise(book);
      assert(page.__errors.length === 0, page.__errors.join('\n'));
      await page.close();
      const linked = await boot(browser, server, book);
      await linked.goto(linked.__origin + '/?code=' + CODE, {waitUntil: 'domcontentloaded'});
      await linked.waitForSelector('#codeMask.show');
      const filled = await linked.$eval('#codeInput', el => el.value);
      assert(filled === CODE, 'legacy link prefills the existing field');
      assert(book.posts('/redeem').length === posts, 'legacy link does not redeem by itself');
      await linked.close();
      passed.push('旧码 /redeem 与 /get');
    }
    book.reset();
    {
      for (const width of [320, 390]) {
        const page = await boot(browser, server, book);
        await page.setViewport({width, height: 720, isMobile: true, hasTouch: true, deviceScaleFactor: width === 320 ? 2 : 3});
        await openHome(page);
        const start = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth
        }));
        assert(start.scroll <= start.client + 1, width + ' start overflows ' + start.scroll);
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
        assert(box.title === '输入订单号', 'title');
        assert(box.copy.includes('小红书「我的订单」') && box.copy.includes('3 次'), 'copy ' + box.copy);
        assert(box.placeholder === '订单号', 'placeholder');
        await shot(page, 'order-modal-' + width);
        await page.close();
      }
      passed.push('手机 320 与 390');
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(JSON.stringify({ok: true, passed, shots}, null, 2));
}

function documentActive(className) {
  return className.split(/\s+/).includes('active');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
