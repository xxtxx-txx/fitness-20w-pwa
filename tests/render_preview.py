"""Isolated about:blank UI harness, for environments that disallow URL navigation.
This verifies real rendering/event handlers with a memory-backed storage double.
It DOES NOT verify native localStorage, SW, installation, HTTP paths, or offline reopen.
Production source files are unchanged. All transforms are preview-only.
"""
from __future__ import annotations
from pathlib import Path
import base64, datetime as dt, json, re, traceback
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'preview-results'
OUT.mkdir(parents=True,exist_ok=True)
KEY='fitness-20w:/fitness/:v1'
STATE={'programStartDate':'2026-09-14','baselineWeightKg':96.5,'completedDays':{},'settings':{'conditioningChoices':{},'milkMetadata':None,'carbohydrateSource':'rice'},'userData':{},'schemaVersion':1}
results=[]

def build_html():
    html=(ROOT/'index.html').read_text()
    # about:blank cannot import modules or access origin storage. Rendering uses the same
    # module code concatenated below and an explicitly labelled memory-only storage double.
    html=re.sub(r'\s*<meta http-equiv="Content-Security-Policy"[^>]+>','',html)
    html=re.sub(r'\s*<script[^>]*>.*?</script>','',html,flags=re.S)
    html=re.sub(r'\s*<link[^>]+>','',html)
    icon=base64.b64encode((ROOT/'icons/icon-192.png').read_bytes()).decode()
    html=html.replace('src="./icons/icon-192.png"',f'src="data:image/png;base64,{icon}"')
    html=html.replace('</head>','<style>'+(ROOT/'styles.css').read_text()+'</style></head>')
    return html

def bundle():
    parts=[]
    for f in ['date-engine.js','program.js','state.js','app.js']:
        text=(ROOT/f).read_text()
        text=re.sub(r'^import .*?;\n','',text,flags=re.M)
        text=re.sub(r'^export ', '', text,flags=re.M)
        text=text.replace("new URL('./', import.meta.url)","new URL('https://fitness.invalid/fitness/')")
        parts.append(text)
    return '\n'.join(parts)

def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        html,js=build_html(),bundle()
        def page_for(seed=True,width=390,date='2026-09-18'):
            context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,timezone_id='Asia/Kuala_Lumpur',locale='zh-CN')
            page=context.new_page()
            page.clock.set_fixed_time(dt.datetime.fromisoformat(date+'T04:00:00+00:00'))
            page.set_content(html)
            page.evaluate('([key,initial])=>{const m=new Map();if(initial)m.set(key,JSON.stringify(initial));window.__previewStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};Object.defineProperty(window,"localStorage",{value:window.__previewStorage});}',[KEY,STATE if seed is True else seed or None])
            page.add_script_tag(content=js)
            return page,context
        def record(name,fn):
            try:
                detail=fn();results.append({'name':name,'status':'PASS','detail':detail});print('PASS',name,flush=True)
            except Exception as e:
                results.append({'name':name,'status':'FAIL','error':str(e),'traceback':traceback.format_exc()});print('FAIL',name,traceback.format_exc(),flush=True)
        def nav(page,name):page.get_by_role('navigation').get_by_role('button',name=name,exact=True).click()
        def read(page):return page.evaluate('(k)=>JSON.parse(window.__previewStorage.getItem(k))',KEY)
        def newdate(page,date):
            page.clock.set_fixed_time(dt.datetime.fromisoformat(date+'T04:00:00+00:00'))
            page.evaluate("window.dispatchEvent(new Event('focus'))")

        def first_run():
            p,c=page_for(False)
            try:
                assert p.locator('#start-date').input_value()=='2026-09-18'
                p.locator('#start-date').fill('2026-09-14');p.get_by_role('button',name='开始我的 20 周').click()
                expect(p.locator('.workout-title h3')).to_have_text('力量 C')
                expect(p.locator('.week-number')).to_have_text('W01')
                p.screenshot(path=str(OUT/'today-390.png'),full_page=True)
                p.screenshot(path=str(OUT/'today-viewport-390.png'),full_page=False)
            finally:c.close()
        record('UI: first-run form → correct Today, Week 1',first_run)

        def weekdays():
            p,c=page_for()
            try:
                names=['力量 A','Zone 2 有氧','力量 B','恢复日','力量 C','Zone 2 有氧','完全恢复']
                totals=[200,170,200,140,200,170,140]
                for i in range(7):
                    newdate(p,f'2026-09-{14+i}')
                    expect(p.locator('.workout-title h3')).to_have_text(names[i])
                    assert str(totals[i]) in p.locator('.raw-badge').inner_text()
                    assert [int(x) for x in p.locator('.rice-dose strong').all_text_contents()]==[totals[i]//2]*2
                    assert [int(x) for x in p.locator('[data-meal="breakfast"] strong').all_text_contents()]==[3,60,250]
                    assert p.locator('[data-meal="dinner"]').inner_text().find('生去皮去骨鸡腿肉')>=0
                return '7 weekdays, all raw rice splits, exact 3 / 60 / 250 breakfast'
            finally:c.close()
        record('UI: seven weekdays and meal quantities',weekdays)

        def completion():
            p,c=page_for()
            try:
                p.get_by_role('button',name='今日完成',exact=True).click()
                expect(p.locator('.completion-done')).to_be_visible()
                assert read(p)['completedDays'].get('2026-09-18')
                p.get_by_role('button',name='撤销完成').click();p.locator('[value="cancel"]').click()
                expect(p.locator('.completion-done')).to_be_visible()
                nav(p,'本周');assert 'is-complete' in p.locator('[data-date="2026-09-18"]').get_attribute('class')
                p.screenshot(path=str(OUT/'week-390.png'),full_page=True)
                nav(p,'今天');p.get_by_role('button',name='撤销完成').click();p.locator('[value="confirm"]').click()
                expect(p.get_by_role('button',name='今日完成',exact=True)).to_be_visible()
                assert read(p)['completedDays']=={}
            finally:c.close()
        record('UI: completion, Week reflection, deliberate undo (memory double)',completion)

        def dates():
            p,c=page_for()
            try:
                nav(p,'本周');p.locator('[data-date="2026-09-16"]').click()
                expect(p.locator('.workout-title h3')).to_have_text('力量 B')
                assert '今天是 9月18日' in p.locator('.preview-bar').inner_text()
                p.get_by_role('button',name='回到今天',exact=True).click()
                expect(p.locator('.workout-title h3')).to_have_text('力量 C')
                nav(p,'本周');p.get_by_role('button',name='下一周').click();p.locator('[data-date="2026-09-21"]').click()
                assert p.locator('#complete-day').count()==0
                newdate(p,'2026-09-19');expect(p.locator('.workout-title h3')).to_have_text('Zone 2 有氧')
            finally:c.close()
        record('UI: preview separation, future check-off guard, local date resume',dates)

        def phases():
            p,c=page_for()
            try:
                for week in [4,5,8,9,12,13,16,17,18,19,20]:
                    date=(dt.date(2026,9,14)+dt.timedelta(days=5+7*(week-1))).isoformat();newdate(p,date)
                    if 5<=week<=16:
                        p.locator('[data-conditioning="mrt"]').click();expect(p.locator('.workout-title h3')).to_have_text('MRT 循环训练')
                        assert '硬拉' not in p.locator('.simple-items').inner_text()
                        p.locator('[data-conditioning="zone2"]').click()
                    else: assert p.locator('[data-conditioning]').count()==0
                    if week==19:expect(p.locator('.duration')).to_have_text('20–30 分钟')
                    if week==20:expect(p.locator('.workout-title h3')).to_have_text('评估与恢复')
                newdate(p,'2026-10-05');expect(p.locator('.reduction-notice')).to_be_visible()
                assert all('常规参考' in x for x in p.locator('.exercise-dose').all_text_contents())
                p.screenshot(path=str(OUT/'reduction-week-390.png'),full_page=True)
            finally:c.close()
        record('UI: Saturday phase rules and reduced-volume reference labels',phases)

        def cycle_end():
            p,c=page_for()
            try:
                newdate(p,'2027-01-31');expect(p.locator('.week-number')).to_have_text('W20')
                newdate(p,'2027-02-01');expect(p.locator('.cycle-complete')).to_be_visible()
                assert p.locator('.week-number').count()==0
                p.get_by_role('button',name='查看第 20 周').click();assert p.locator('.week-row').count()==7
            finally:c.close()
        record('UI: day 140 / day 141 boundary does not restart',cycle_end)

        def responsive():
            checks=[]
            for width in [320,360,390,412,768,1280]:
                p,c=page_for(width=width)
                try:
                    for scene in ['今天','本周','设置']:
                        nav(p,scene)
                        assert p.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,scene)
                        small=[]
                        for t in p.locator('button:visible, summary:visible').all():
                            box=t.bounding_box()
                            if box['height']<43.9:small.append([t.inner_text(),box['height']])
                        assert not small,(width,scene,small)
                        checks.append(f'{width}:{scene}')
                    nav(p,'今天')
                    if width in [320,1280]:p.screenshot(path=str(OUT/f'today-{width}.png'),full_page=True)
                    nav(p,'设置')
                    if width==390:p.screenshot(path=str(OUT/'settings-390.png'),full_page=True)
                finally:c.close()
            p,c=page_for(False,width=320)
            try:
                assert p.evaluate('document.documentElement.scrollWidth <= innerWidth')
                p.screenshot(path=str(OUT/'setup-320.png'),full_page=True)
            finally:c.close()
            return checks
        record('UI: 320–1280px, three views, no overflow, >=44px targets',responsive)

        def settings():
            p,c=page_for()
            try:
                p.get_by_role('button',name='今日完成',exact=True).click();nav(p,'设置')
                p.locator('#settings-start').fill('2026-09-16');p.locator('#baseline-weight').fill('95.5')
                p.get_by_role('button',name='保存设置',exact=True).click();p.locator('[value="cancel"]').click()
                assert read(p)['programStartDate']=='2026-09-14'
                p.get_by_role('button',name='保存设置',exact=True).click();p.locator('[value="confirm"]').click()
                expect(p.locator('#toast')).to_contain_text('设置已保存')
                assert read(p)['programStartDate']=='2026-09-16';assert read(p)['completedDays'].get('2026-09-18')
                p.get_by_role('button',name='清空所有完成记录').click();p.locator('[value="confirm"]').click()
                expect(p.locator('#toast')).to_contain_text('完成记录已清空')
                assert read(p)['completedDays']=={};assert read(p)['baselineWeightKg']==95.5
            finally:c.close()
        record('UI: settings confirmations preserve history / reset only check-offs',settings)

        def save_failure():
            p,c=page_for()
            try:
                p.evaluate('() => { window.__previewStorage.setItem=()=>{throw new Error("quota");}; }')
                p.get_by_role('button',name='今日完成',exact=True).click()
                expect(p.locator('#toast')).to_contain_text('本地保存失败')
                assert p.locator('.completion-done').count()==0
            finally:c.close()
        record('UI: a failed storage write is not reported as completed',save_failure)
        browser.close()
    report={'harness':'about:blank, inlined production JS/CSS, in-memory storage double; no network navigation and no native PWA test','passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'checks':results,'native_install_offline_status':'NOT_TESTED'}
    (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False),flush=True)
    return report['failed']
if __name__=='__main__':raise SystemExit(1 if run() else 0)
