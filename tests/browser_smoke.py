"""Optional browser verification. pip install playwright; playwright install chromium.
Run: python tests/browser_smoke.py [--chromium /path/to/chromium]
Runs against an isolated copy at /fitness/; never edits the delivered app or user data.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from contextlib import contextmanager
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'browser-results'
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'fitness-20w:/fitness/:v1'
RESULTS: list[dict] = []
BASE_DATE = '2026-09-18'

def state(start='2026-09-14'):
    return {'programStartDate': start, 'baselineWeightKg': 96.5, 'completedDays': {}, 'settings': {'conditioningChoices': {}, 'milkMetadata': None, 'carbohydrateSource': 'rice'}, 'userData': {}, 'schemaVersion': 1}

def instant(date=BASE_DATE):
    # 12:00 in Kuala Lumpur; timezone is independently configured in Chromium.
    return dt.datetime.fromisoformat(date + 'T04:00:00+00:00')

def record(name, fn):
    begin=time.monotonic()
    try:
        detail=fn()
        RESULTS.append({'name':name,'status':'PASS','seconds':round(time.monotonic()-begin,3),'detail':detail})
        print('PASS',name,flush=True)
    except Exception as e:
        RESULTS.append({'name':name,'status':'FAIL','seconds':round(time.monotonic()-begin,3),'error':str(e)})
        print('FAIL',name,str(e),flush=True)

def wait_server(port):
    for _ in range(100):
        try:
            with socket.create_connection(('127.0.0.1',port),timeout=.1): return
        except OSError: time.sleep(.05)
    raise RuntimeError('Static test server failed to start')

def run(chromium_path):
    with tempfile.TemporaryDirectory(prefix='fitness-browser-') as temporary, sync_playwright() as pw:
        fixture=Path(temporary)/'site'
        shutil.copytree(ROOT,fixture,ignore=shutil.ignore_patterns('browser-results','dist','.git','__pycache__'))
        sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
        server=subprocess.Popen(['node',str(fixture/'tools'/'serve.mjs'),'--port',str(port),'--base','/fitness/'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        wait_server(port)
        url=f'http://127.0.0.1:{port}/fitness/'
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if chromium_path: launch['executable_path']=chromium_path
        try:
            browser=pw.chromium.launch(**launch)
        except Exception:
            server.terminate();server.wait(timeout=5)
            raise
        common={'viewport':{'width':390,'height':844},'device_scale_factor':1,'is_mobile':True,'has_touch':True,'timezone_id':'Asia/Kuala_Lumpur','locale':'zh-CN'}
        @contextmanager
        def app(seed=True,date=BASE_DATE,width=390):
            options={**common,'viewport':{'width':width,'height':844}}
            context=browser.new_context(**options)
            page=context.new_page();page.clock.set_fixed_time(instant(date))
            page.goto(url)
            if seed:
                page.evaluate('([key,s]) => localStorage.setItem(key, JSON.stringify(s))',[KEY,state() if seed is True else seed])
                page.reload()
            page.wait_for_selector('#main h1')
            try: yield page,context
            finally: context.close()
        def read_state(page): return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
        def choose_view(page,name): page.get_by_role('navigation').get_by_role('button',name=name,exact=True).click()
        def accept_dialog(page): page.locator('#confirm-dialog [value="confirm"]').click();page.wait_for_timeout(100)
        def cancel_dialog(page): page.locator('#confirm-dialog [value="cancel"]').click();page.wait_for_timeout(100)
        def import_file(page,value):
            page.locator('#import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(value).encode() if not isinstance(value,str) else value.encode()})
        def ready(page):
            page.evaluate('() => navigator.serviceWorker.ready.then(() => true)')
            page.wait_for_function('!!navigator.serviceWorker.controller')
            expect(page.locator('#offline-status')).to_contain_text('就绪')

        @contextmanager
        def persistent_app(profile_name):
            # A persistent profile is not incognito, so Chromium can report real
            # installability diagnostics instead of the 'in-incognito' error.
            profile=Path(temporary)/profile_name
            context=pw.chromium.launch_persistent_context(str(profile),**launch,**common)
            page=context.pages[0];page.goto(url);page.wait_for_selector('#main h1')
            try: yield page,context
            finally: context.close()

        def setup():
            with app(seed=False) as (page,_):
                expect(page.get_by_role('heading',name='从哪天开始？')).to_be_visible()
                assert page.locator('#start-date').input_value()=='2026-09-18'
                page.locator('#start-date').fill('2026-09-14')
                page.get_by_role('button',name='开始我的 20 周').click()
                assert read_state(page)['programStartDate']=='2026-09-14'
                expect(page.locator('.week-number')).to_have_text('W01')
                expect(page.locator('.workout-title h3')).to_have_text('力量 C')
                assert '星期五' in page.locator('.page-heading').inner_text()
                page.screenshot(path=str(OUT/'today-390.png'),full_page=True)
                page.screenshot(path=str(OUT/'today-viewport-390.png'),full_page=False)
        record('First launch → configured local Today; Friday / Week 1',setup)

        def weekdays():
            expected=[('2026-09-14','力量 A',200,100),('2026-09-15','Zone 2 有氧',170,85),('2026-09-16','力量 B',200,100),('2026-09-17','恢复日',140,70),('2026-09-18','力量 C',200,100),('2026-09-19','Zone 2 有氧',170,85),('2026-09-20','完全恢复',140,70)]
            with app() as (page,_):
                for date,title,total,half in expected:
                    page.clock.set_fixed_time(instant(date));page.evaluate("window.dispatchEvent(new Event('focus'))")
                    expect(page.locator('.workout-title h3')).to_have_text(title)
                    assert str(total) in page.locator('.raw-badge').inner_text()
                    assert [int(x) for x in page.locator('.rice-dose strong').all_text_contents()]==[half,half]
                    assert [int(x) for x in page.locator('[data-meal="breakfast"] strong').all_text_contents()]==[3,60,250]
                    assert page.locator('[data-meal="lunch"] .meal-food > p > strong').first.inner_text()=='400'
                    assert page.locator('[data-meal="dinner"] .meal-food > p > strong').first.inner_text()=='220'
                return 'All 7 weekdays; exact breakfast and protein quantities'
        record('AT-03/05–14: rendered weekday workouts and nutrition',weekdays)

        def persistence():
            with app() as (page,context):
                page.get_by_role('button',name='今日完成',exact=True).click()
                expect(page.locator('.completion-done')).to_contain_text('今日已完成')
                saved=read_state(page)['completedDays']['2026-09-18']
                page.reload();expect(page.locator('.completion-done')).to_be_visible()
                choose_view(page,'本周')
                assert 'is-complete' in page.locator('[data-date="2026-09-18"]').get_attribute('class')
                page.screenshot(path=str(OUT/'week-390.png'),full_page=True)
                page.close();page=context.new_page();page.clock.set_fixed_time(instant());page.goto(url)
                expect(page.locator('.completion-done')).to_be_visible()
                assert read_state(page)['completedDays']['2026-09-18']==saved
        record('AT-16: completion persists through reload, tab close and Week view',persistence)

        def undo():
            with app() as (page,_):
                page.get_by_role('button',name='今日完成',exact=True).click()
                page.get_by_role('button',name='撤销完成').click();cancel_dialog(page)
                assert '2026-09-18' in read_state(page)['completedDays']
                page.get_by_role('button',name='撤销完成').click();accept_dialog(page)
                assert '2026-09-18' not in read_state(page)['completedDays']
                expect(page.get_by_role('button',name='今日完成',exact=True)).to_be_visible()
        record('Undo requires a deliberate confirmation, cancel is non-destructive',undo)

        def browse():
            with app() as (page,_):
                choose_view(page,'本周');page.locator('[data-date="2026-09-16"]').click()
                expect(page.locator('.workout-title h3')).to_have_text('力量 B')
                assert '今天是 9月18日' in page.locator('.preview-bar').inner_text()
                page.get_by_role('button',name='回到今天',exact=True).click()
                expect(page.locator('.workout-title h3')).to_have_text('力量 C')
                choose_view(page,'本周');page.get_by_role('button',name='下一周').click()
                page.locator('[data-date="2026-09-21"]').click()
                assert page.locator('#complete-day').count()==0
                assert '未来计划' in page.locator('.completion-area').inner_text()
        record('Manual browsing never changes Today; future check-off is unavailable',browse)

        def saturday():
            with app() as (page,_):
                for week in [1,4,5,8,9,12,13,16,17,18,19,20]:
                    date=(dt.date(2026,9,14)+dt.timedelta(days=5+7*(week-1))).isoformat()
                    page.clock.set_fixed_time(instant(date));page.evaluate("window.dispatchEvent(new Event('focus'))")
                    if 5<=week<=16:
                        page.locator('[data-conditioning="mrt"]').click()
                        expect(page.locator('.workout-title h3')).to_have_text('MRT 循环训练')
                        assert '硬拉' not in page.locator('.simple-items').inner_text()
                        page.reload();expect(page.locator('.workout-title h3')).to_have_text('MRT 循环训练')
                        page.locator('[data-conditioning="zone2"]').click()
                    else:
                        assert page.locator('[data-conditioning]').count()==0
                        if week==19: expect(page.locator('.duration')).to_have_text('20–30 分钟')
                        if week==20: expect(page.locator('.workout-title h3')).to_have_text('评估与恢复')
        record('AT-10: Saturday choices, persistence and all phase transitions',saturday)

        def phase_ui():
            with app() as (page,_):
                for week in [4,8,12,16,19]:
                    date=(dt.date(2026,9,14)+dt.timedelta(days=7*(week-1))).isoformat()
                    page.clock.set_fixed_time(instant(date));page.evaluate("window.dispatchEvent(new Event('focus'))")
                    expect(page.locator('.reduction-notice')).to_be_visible()
                    assert all('常规参考' in value for value in page.locator('.exercise-dose').all_text_contents())
                    if week==19: assert '40%' in page.locator('.reduction-notice').inner_text()
                page.screenshot(path=str(OUT/'reduction-week-390.png'),full_page=True)
        record('Recovery weeks visibly distinguish normal-reference sets from targets',phase_ui)

        def boundaries():
            with app(seed=state('2026-09-21')) as (page,_):
                assert '尚未开始' in page.locator('.page-heading').inner_text()
                assert page.locator('#complete-day').count()==0
            s=state();s['completedDays']['2026-09-14']=True
            with app(seed=s,date='2027-01-31') as (page,_):
                expect(page.locator('.week-number')).to_have_text('W20')
                page.clock.set_fixed_time(instant('2027-02-01'));page.evaluate("window.dispatchEvent(new Event('focus'))")
                expect(page.locator('.cycle-complete')).to_be_visible()
                assert page.locator('.week-number').count()==0
                assert read_state(page)['completedDays']['2026-09-14'] is True
                page.get_by_role('button',name='查看第 20 周').click()
                assert page.locator('.week-row').count()==7
        record('AT-04/19: before start, day 140, day 141; history preserved',boundaries)

        def responsive():
            checked=[]
            for width in [320,360,390,412,768,1280]:
                with app(width=width) as (page,_):
                    for scene in ['今天','本周','设置']:
                        choose_view(page,scene)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,scene)
                        # Every visible interactive target is at least 44 CSS px tall.
                        targets=page.locator('button:visible, summary:visible').all()
                        small=[(t.inner_text(),t.bounding_box()['height']) for t in targets if t.bounding_box()['height']<43.9]
                        assert not small,(width,scene,small)
                        checked.append(f'{width}:{scene}')
                    choose_view(page,'今天')
                    if width in [320,1280]: page.screenshot(path=str(OUT/f'today-{width}.png'),full_page=True)
                    choose_view(page,'设置')
                    if width==390: page.screenshot(path=str(OUT/'settings-390.png'),full_page=True)
            with app(seed=False,width=320) as (page,_):
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=str(OUT/'setup-320.png'),full_page=True)
            return checked
        record('AT-18: 320–1280px, all views; no overflow, >=44px touch targets',responsive)

        def export_roundtrip():
            with app() as (page,_):
                page.get_by_role('button',name='今日完成',exact=True).click();choose_view(page,'设置')
                with page.expect_download() as d: page.get_by_role('button',name='导出 JSON').click()
                exported=json.loads(Path(d.value.path()).read_text())
                assert exported==read_state(page)
                assert exported['schemaVersion']==1
                return {'file':d.value.suggested_filename,'records':len(exported['completedDays'])}
        record('Backup export contains exact persisted configuration and records',export_roundtrip)

        def imports():
            with app() as (page,_):
                choose_view(page,'设置');original=read_state(page)
                for invalid in ['{broken',{'schemaVersion':2},[1,2,3]]:
                    import_file(page,invalid)
                    expect(page.locator('#toast')).to_have_class('toast toast-error')
                    assert read_state(page)==original
                    assert not page.locator('#confirm-dialog').is_visible()
                imported=state('2026-09-16');imported['baselineWeightKg']=95.2;imported['completedDays']['2026-09-16']=True
                imported['userData']={'futureMeasurements':[]}
                import_file(page,imported);cancel_dialog(page)
                assert read_state(page)==original
                import_file(page,imported);accept_dialog(page)
                assert read_state(page)==imported
                expect(page.locator('.workout-title h3')).to_have_text('力量 C')
                expect(page.locator('.heading-date')).to_contain_text('第 3 / 140 天')
        record('Import rejects malformed data; cancellation preserves data; valid restore works',imports)

        def settings_edits():
            with app() as (page,_):
                page.get_by_role('button',name='今日完成',exact=True).click();choose_view(page,'设置')
                page.locator('#settings-start').fill('2026-09-16');page.locator('#baseline-weight').fill('95.5')
                page.get_by_role('button',name='保存设置',exact=True).click();cancel_dialog(page)
                assert read_state(page)['programStartDate']=='2026-09-14'
                page.get_by_role('button',name='保存设置',exact=True).click();accept_dialog(page)
                assert read_state(page)['programStartDate']=='2026-09-16'
                assert read_state(page)['baselineWeightKg']==95.5
                assert '2026-09-18' in read_state(page)['completedDays']
                page.get_by_role('button',name='清空所有完成记录').click();cancel_dialog(page)
                assert len(read_state(page)['completedDays'])==1
                page.get_by_role('button',name='清空所有完成记录').click();accept_dialog(page)
                s=read_state(page);assert s['completedDays']=={};assert s['baselineWeightKg']==95.5;assert s['programStartDate']=='2026-09-16'
        record('Start date change and reset confirmations preserve unrelated configuration',settings_edits)

        def corruption():
            with app() as (page,_):
                page.evaluate('(key)=>localStorage.setItem(key,"broken")',KEY);page.reload()
                expect(page.get_by_role('heading',name='暂时无法读取数据')).to_be_visible()
                assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)=='broken'
                with page.expect_download() as d: page.get_by_role('button',name='导出原始数据').click()
                assert Path(d.value.path()).read_text()=='broken'
                import_file(page,state());accept_dialog(page)
                expect(page.locator('.workout-title h3')).to_have_text('力量 C')
        record('Corrupt storage is not overwritten; raw export and backup recovery work',corruption)

        def quota():
            with app() as (page,_):
                page.evaluate("() => { Storage.prototype.setItem = () => { throw new DOMException('quota','QuotaExceededError'); }; }")
                page.get_by_role('button',name='今日完成',exact=True).click()
                expect(page.locator('#toast')).to_contain_text('本地保存失败')
                assert read_state(page)['completedDays']=={}
                assert page.locator('.completion-done').count()==0
                expect(page.get_by_role('button',name='今日完成',exact=True)).to_be_enabled()
        record('Storage failure does not falsely mark Today completed',quota)

        def tabs():
            with app() as (page,context):
                second=context.new_page();second.clock.set_fixed_time(instant());second.goto(url)
                page.get_by_role('button',name='今日完成',exact=True).click()
                expect(second.locator('.completion-done')).to_be_visible()
        record('Cross-tab storage events refresh completion state',tabs)

        def midnight():
            with app(date='2026-09-18') as (page,_):
                # Midnight in Kuala Lumpur is the previous date at 16:00 UTC.
                page.clock.set_fixed_time(dt.datetime.fromisoformat('2026-09-18T16:01:00+00:00'))
                page.evaluate("window.dispatchEvent(new Event('focus'))")
                expect(page.locator('.workout-title h3')).to_have_text('Zone 2 有氧')
                assert '9月19日' in page.locator('.page-heading').inner_text()
                assert '星期六' in page.locator('.page-heading').inner_text()
        record('Local UTC+8 midnight refreshes Today on resume',midnight)

        def manifest():
            with persistent_app('installability-profile') as (page,context):
                ready(page)
                session=context.new_cdp_session(page)
                manifest=session.send('Page.getAppManifest')
                assert manifest.get('errors',[])==[],manifest
                parsed=json.loads(manifest['data']);assert parsed['display']=='standalone'
                errors=session.send('Page.getInstallabilityErrors')['installabilityErrors']
                assert errors==[],errors
                reg=page.evaluate('navigator.serviceWorker.ready.then(r => ({scope:r.scope, state:r.active.state}))')
                assert reg['scope']==url
                assert reg['state']=='activated'
                return {'manifestErrors':[],'installabilityErrors':errors,'scope':reg['scope'],'browser':browser.version,'note':'Native device installation / standalone launch still require a phone test.'}
        record('AT-01: Chromium installability diagnostics; SW scope under /fitness/',manifest)

        def external_and_console():
            context=browser.new_context(**common);page=context.new_page();errors=[];requests=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.on('request',lambda r:requests.append(r.url))
            page.clock.set_fixed_time(instant());page.goto(url)
            page.locator('#start-date').fill('2026-09-14');page.get_by_role('button',name='开始我的 20 周').click();ready(page)
            for name in ['本周','设置','今天']: choose_view(page,name)
            assert errors==[],errors
            assert all(r.startswith(url) for r in requests),requests
            # page.clock replaces the timeline, so the navigation entry may be absent here.
            metrics=page.evaluate('({navigation:performance.getEntriesByType("navigation")[0]?.duration ?? null, paint:performance.getEntriesByType("paint").map(e=>({name:e.name,startTime:e.startTime}))})')
            context.close()
            return {'externalRequests':0,'consoleErrors':0,'timingLocalOnly':metrics}
        record('AT-17: zero external requests and no console-breaking errors',external_and_console)

        def service_worker_update():
            sw=fixture/'sw.js';program=fixture/'program.js';old_sw=sw.read_text();old_program=program.read_text()
            try:
                with app() as (page,_):
                    ready(page);page.get_by_role('button',name='今日完成',exact=True).click()
                    page.evaluate("caches.open('unrelated-app-cache').then(c=>c.put('./other.txt',new Response('keep')))" )
                    sw.write_text(old_sw.replace("RELEASE = '0.1.0'","RELEASE = '0.1.1'"))
                    program.write_text(old_program.replace("APP_VERSION = '0.1.0'","APP_VERSION = '0.1.1'"))
                    page.evaluate('navigator.serviceWorker.ready.then(r=>r.update())')
                    expect(page.locator('#update-notice')).to_be_visible(timeout=15000)
                    assert any(k.endswith(':0.1.0') for k in page.evaluate('caches.keys()'))
                    # Applying an update must be a real reload, not an in-place DOM patch.
                    with page.expect_event('framenavigated',timeout=15000):
                        page.locator('#apply-update').click()
                    expect(page.locator('.completion-done')).to_be_visible()
                    page.wait_for_function("caches.keys().then(ks=>ks.some(k=>k.endsWith(':0.1.1')) && !ks.some(k=>k.endsWith(':0.1.0')))")
                    assert 'unrelated-app-cache' in page.evaluate('caches.keys()')
                    choose_view(page,'设置');expect(page.locator('.version-pill')).to_have_text('v0.1.1')
                    return 'Waiting update → explicit activation → coherent reload; records and foreign cache retained'
            finally: sw.write_text(old_sw);program.write_text(old_program)
        record('Versioned cache update is explicit and preserves local records / other apps',service_worker_update)

        def failed_update():
            sw=fixture/'sw.js';old=sw.read_text()
            try:
                with app() as (page,context):
                    ready(page)
                    sw.write_text(old.replace("RELEASE = '0.1.0'","RELEASE = 'bad-release'").replace("'./index.html',", "'./missing-required-file.js', './index.html',",1))
                    page.evaluate('navigator.serviceWorker.ready.then(r=>r.update())')
                    page.wait_for_function("navigator.serviceWorker.getRegistration().then(r=>!r.installing && !r.waiting)")
                    context.set_offline(True);page.reload()
                    expect(page.locator('.workout-title h3')).to_have_text('力量 C')
                    assert any(k.endswith(':0.1.0') for k in page.evaluate('caches.keys()'))
                    return 'Deliberately missing precache asset does not replace the working app'
            finally: sw.write_text(old)
        record('Failed precache update leaves the previous offline app available',failed_update)

        def offline_restart():
            nonlocal server
            profile=Path(temporary)/'persistent-profile'
            context=pw.chromium.launch_persistent_context(str(profile),**launch,**common)
            page=context.pages[0];page.clock.set_fixed_time(instant());page.goto(url)
            page.locator('#start-date').fill('2026-09-14');page.get_by_role('button',name='开始我的 20 周').click();ready(page)
            page.get_by_role('button',name='今日完成',exact=True).click()
            context.close()
            # Shut down the actual server, in addition to setting Chromium offline.
            server.terminate();server.wait(timeout=5)
            context=pw.chromium.launch_persistent_context(str(profile),**launch,**common)
            context.set_offline(True)
            page=context.pages[0];page.clock.set_fixed_time(instant());page.goto(url)
            expect(page.locator('.workout-title h3')).to_have_text('力量 C')
            expect(page.locator('[data-meal="dinner"]')).to_contain_text('生去皮去骨鸡腿肉')
            expect(page.locator('.completion-done')).to_be_visible()
            page.screenshot(path=str(OUT/'offline-restart-390.png'),full_page=True)
            page.get_by_role('button',name='撤销完成').click();accept_dialog(page)
            page.reload();expect(page.get_by_role('button',name='今日完成',exact=True)).to_be_visible()
            page.get_by_role('button',name='今日完成',exact=True).click();page.reload();expect(page.locator('.completion-done')).to_be_visible()
            context.close()
            return 'Browser process restarted with its persistent profile, actual server stopped, network offline; plans + saved completion + further writes all passed'
        record('AT-15/16: full browser restart offline, with static server stopped',offline_restart)
        browser.close()
        if server.poll() is None: server.terminate();server.wait(timeout=5)
    payload={'checks':RESULTS,'passed':sum(r['status']=='PASS' for r in RESULTS),'failed':sum(r['status']=='FAIL' for r in RESULTS),'not_tested':['Native Android install and launcher-icon standalone launch','Native iOS Safari home-screen launch','Real phone airplane-mode reopen','User comprehension within 3 seconds']}
    (OUT/'results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in payload.items() if k!='checks'},ensure_ascii=False),flush=True)
    return payload['failed']

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--chromium',default=os.environ.get('CHROMIUM_PATH'))
    args=parser.parse_args();raise SystemExit(1 if run(args.chromium) else 0)
