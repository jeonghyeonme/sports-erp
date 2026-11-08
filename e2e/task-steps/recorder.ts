import { Locator, Page, TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../env';

/**
 * 작업 단계 측정(log/198) — 사용자가 하는 동작을 이 기록기로만 부르게 해서 "몇 번 누르고 몇 칸을 채웠나"를 센다.
 * 로그인은 세지 않는다(로그인 직후 첫 화면에서 시작). 화면 이동은 주소 경로(path)가 바뀐 횟수,
 * 스크롤은 동작 직전에 대상이 보이는 영역 밖이었던 횟수다(Playwright가 대신 스크롤해 주므로 따로 기록한다).
 * 결과는 실행할 때마다 e2e/task-steps/out/results(-dense).json에 작업 하나씩 덮어쓴다 — 개선 전후 비교용.
 */
/** 기준 시드(5곳 최소)와 시연 데이터 층(E2E_DENSE=1, D58)의 결과를 따로 둔다. */
export const RESULT_FILE = process.env.E2E_DENSE === '1' ? 'results-dense.json' : 'results.json';

export type Role = '지점 관리자' | '직원' | '본사' | '회원';

type Step = { kind: 'click' | 'field'; label: string; offscreen: boolean };

export class Steps {
  private steps: Step[] = [];
  private paths: string[] = [];
  private recording = false;

  constructor(
    private readonly page: Page,
    readonly id: string,
    readonly role: Role,
    readonly title: string,
  ) {
    page.on('framenavigated', (frame) => {
      if (!this.recording || frame !== page.mainFrame()) return;
      const path = new URL(frame.url()).pathname;
      if (this.paths[this.paths.length - 1] !== path) this.paths.push(path);
    });
  }

  /** 로그인·준비가 끝난 지금 화면에서 세기 시작한다. */
  start() {
    this.recording = true;
    this.paths = [new URL(this.page.url()).pathname];
  }

  private async offscreen(target: Locator): Promise<boolean> {
    await target.waitFor({ state: 'attached' });
    const box = await target.boundingBox();
    const vp = this.page.viewportSize();
    if (!box || !vp) return false;
    return box.y < 0 || box.y + box.height > vp.height;
  }

  async click(target: Locator, label: string) {
    const offscreen = await this.offscreen(target);
    await target.click();
    this.steps.push({ kind: 'click', label, offscreen });
  }

  async fill(target: Locator, value: string, label: string) {
    const offscreen = await this.offscreen(target);
    await target.fill(value);
    this.steps.push({ kind: 'field', label, offscreen });
  }

  async select(target: Locator, option: Parameters<Locator['selectOption']>[0], label: string) {
    const offscreen = await this.offscreen(target);
    await target.selectOption(option);
    this.steps.push({ kind: 'field', label, offscreen });
  }

  async upload(target: Locator, file: Parameters<Locator['setInputFiles']>[0], label: string) {
    const offscreen = await this.offscreen(target);
    await target.setInputFiles(file);
    this.steps.push({ kind: 'field', label, offscreen });
  }

  /** 서식 편집기처럼 칸을 누르고 키보드로 치는 입력 — 한 칸으로 센다. */
  async type(target: Locator, text: string, label: string) {
    const offscreen = await this.offscreen(target);
    await target.click();
    await this.page.keyboard.type(text);
    this.steps.push({ kind: 'field', label, offscreen });
  }

  summary() {
    const clicks = this.steps.filter((s) => s.kind === 'click').length;
    const fields = this.steps.filter((s) => s.kind === 'field').length;
    return {
      id: this.id,
      role: this.role,
      title: this.title,
      clicks,
      fields,
      total: clicks + fields,
      screens: this.paths.length,
      scrolls: this.steps.filter((s) => s.offscreen).length,
      path: this.paths.join(' → '),
      steps: this.steps.map((s) => `${s.kind === 'click' ? '누름' : '입력'}:${s.label}${s.offscreen ? '(스크롤)' : ''}`),
    };
  }

  save(testInfo: TestInfo) {
    const dir = join(ROOT, 'e2e/task-steps/out');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, RESULT_FILE);
    const all: Record<string, ReturnType<Steps['summary']>> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    all[this.id] = { ...this.summary(), viewport: testInfo.project.use.viewport } as never;
    writeFileSync(file, JSON.stringify(all, null, 2));
  }
}
