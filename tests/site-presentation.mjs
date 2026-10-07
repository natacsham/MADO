// Presentation-only checks. This does not rerun semantic/ontology validation.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'web');
const artifacts=path.join(root,'tests','.artifacts','site-presentation');
await fs.mkdir(artifacts,{recursive:true});
const modules=process.env.AMADO_NODE_MODULES || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')).href);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.xml':'application/xml','.txt':'text/plain','.wasm':'application/wasm','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    if(!pathname.startsWith('/MADO/')){res.writeHead(404).end();return;}
    let rel=pathname.slice('/MADO/'.length);
    if(!rel || rel.endsWith('/')) rel+='index.html';
    const target=path.resolve(web,rel);
    if(!target.startsWith(web+path.sep)){res.writeHead(403).end();return;}
    const contents=await fs.readFile(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(contents);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=(process.env.AMADO_SITE_URL || `http://127.0.0.1:${server.address().port}/MADO/`).replace(/\/?$/,'/');
const origin=new URL(base).origin;
const publicBase='https://natacsham.github.io/MADO/';
const browser=await chromium.launch({headless:true,executablePath:process.env.AMADO_CHROMIUM || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const report={
  scope:'Conteúdo, navegação, SEO técnico e apresentação acessível; não revalida motor ou ontologia.',
  execution_target:process.env.AMADO_SITE_URL?'PUBLIC_SITE':'LOCAL_SUBPATH',
  browser:browser.version(),started_at_utc:new Date().toISOString(),checks:{},pages:{},errors:[],external_requests:[],request_methods:[],
  limitations:['Não é declaração de conformidade WCAG.','NVDA, VoiceOver e fala audível não avaliados.','Metadados corretos não garantem indexação nem posição em buscas.','Contraste medido em amostra de elementos e estados; não cobre todos os pixels.','Casos e resultados semânticos permanecem vinculados aos relatórios de execução próprios.']
};
if(process.env.AMADO_SITE_URL) report.public_url=base;
if(process.env.AMADO_DEPLOYMENT_COMMIT) report.repository_commit_at_test=process.env.AMADO_DEPLOYMENT_COMMIT;
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
report.build=JSON.parse(await fs.readFile(path.join(web,'amado','manifest.json'),'utf8'));
report.source_sha256={};
for(const name of ['index.html','ontologia/index.html','site.css','shell.css','site.js','amado/index.html','amado/styles.css','amado/app.js','robots.txt','sitemap.xml']){
  try{report.source_sha256[name]=sha(await fs.readFile(path.join(web,name)));}catch{}
}
report.site_assets_sha256={};
for(const name of Object.keys(report.build.site_assets_sha256||{})){
  report.site_assets_sha256[name]=sha(await fs.readFile(path.join(web,name)));
}
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
await context.route('**/*',async route=>{
  const req=route.request();
  if(!req.url().startsWith(origin+'/') && !req.url().startsWith('blob:')){
    report.external_requests.push(req.url());return route.abort();
  }
  report.request_methods.push(req.method());return route.continue();
});
const page=await context.newPage();
page.on('pageerror',error=>report.errors.push(error.message));
const check=(key,value)=>{report.checks[key]=Boolean(value);assert(value,key);};
const settled=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const idle=()=>page.waitForFunction(()=>document.getElementById('main')?.getAttribute('aria-busy')==='false',{}, {timeout:180000});
async function keyboardFocus(selector){
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
  for(let n=0;n<80;n++){
    await page.keyboard.press('Tab');
    if(await page.locator(selector).evaluate(el=>el===document.activeElement)) return;
  }
  throw new Error('Tab did not reach '+selector);
}
async function focusSample(selector){
  return page.locator(selector).evaluate(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return {outline_style:s.outlineStyle,outline_width:s.outlineWidth,outline_color:s.outlineColor,visible:r.width>0&&r.height>0,in_view:r.top>=0&&r.bottom<=innerHeight};
  });
}
async function textSamples(){
  return page.evaluate(()=>{
    const rgba=value=>{
      const m=value.match(/rgba?\(([^)]+)\)/);if(!m)return null;
      const v=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);return [...v.slice(0,3),v[3]??1];
    };
    const blend=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3]));
    function bg(el){
      const layers=[];let n=el;
      while(n){const c=rgba(getComputedStyle(n).backgroundColor);if(c)layers.push(c);n=n.parentElement;}
      let out=[255,255,255];for(const c of layers.reverse())out=blend(c,out);return out;
    }
    const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
    const result=[];
    for(const selector of ['h1','h2','p','summary','a.button','button:not([disabled])','.nav a','.site-footer p','.topbar a','.topbar button:not([disabled])','[data-reading-status]']){
      const elements=[...document.querySelectorAll(selector)].filter(el=>el.checkVisibility() && el.textContent.trim());
      for(const el of elements.slice(0,3)){
        const s=getComputedStyle(el),foreground=rgba(s.color),background=bg(el);
        if(!foreground || s.opacity!=='1')continue;
        const rendered=blend(foreground,background),l1=lum(rendered),l2=lum(background);
        const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        const large=parseFloat(s.fontSize)>=24 || (parseFloat(s.fontSize)>=18.66 && parseInt(s.fontWeight)>=700);
        result.push({selector,text:el.textContent.trim().slice(0,65),foreground:s.color,background:background.map(Math.round),ratio,minimum:large?3:4.5});
      }
    }
    return result;
  });
}
async function assertReflow(key){
  await settled();
  const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  report.layout_dimensions??={};report.layout_dimensions[key]=size;
  if(size.scroll>size.viewport+1){
    report.layout_overflow??={};
    report.layout_overflow[key]=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.checkVisibility()&&el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({tag:el.tagName,id:el.id,text:el.textContent.trim().slice(0,80),right:el.getBoundingClientRect().right})));
  }
  check(key,size.scroll<=size.viewport+1);return size;
}
try{
  check('site_assets_match_manifest',Object.keys(report.site_assets_sha256).length>=5 && JSON.stringify(report.site_assets_sha256)===JSON.stringify(report.build.site_assets_sha256));
  report.served_site_assets_sha256={};
  for(const name of Object.keys(report.site_assets_sha256)){
    const response=await context.request.get(base+name);
    assert.equal(response.status(),200,'Asset must be served: '+name);
    report.served_site_assets_sha256[name]=sha(await response.body());
  }
  check('served_site_assets_match',JSON.stringify(report.served_site_assets_sha256)===JSON.stringify(report.site_assets_sha256));
  const titles=[];
  for(const [name,rel] of [['home',''],['ontology','ontologia/'],['amado','amado/']]){
    await page.setViewportSize({width:1280,height:900});
    await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
    const response=await page.goto(base+rel,{waitUntil:'domcontentloaded'});
    check(name+'_http_200',response.status()===200);
    if(name==='amado')await idle();
    const metadata=await page.evaluate(()=>({
      title:document.title,lang:document.documentElement.lang,
      author:document.querySelector('meta[name="author"]')?.content,
      description:document.querySelector('meta[name="description"]')?.content,
      canonical:document.querySelector('link[rel="canonical"]')?.href,
      og_title:document.querySelector('meta[property="og:title"]')?.content,
      og_url:document.querySelector('meta[property="og:url"]')?.content,
      robots:document.querySelector('meta[name="robots"]')?.content,
      jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(x=>JSON.parse(x.textContent)),
      h1_count:document.querySelectorAll('h1').length,main_count:document.querySelectorAll('main').length
    }));
    report.pages[name]={metadata};titles.push(metadata.title);
    const pageFile=rel+'index.html';
    check(name+'_served_source_matches',sha(await response.body())===report.source_sha256[pageFile]);
    check(name+'_semantic_document',metadata.lang==='pt-BR'&&metadata.h1_count===1&&metadata.main_count===1);
    check(name+'_seo',metadata.title.length>10&&metadata.description?.length>30&&metadata.canonical===publicBase+rel&&metadata.og_url===metadata.canonical&&Boolean(metadata.og_title)&&metadata.jsonld.length>0&&!/noindex/i.test(metadata.robots||''));
    check(name+'_jsonld_schema',metadata.jsonld.every(x=>x['@context']==='https://schema.org' && Boolean(x['@type']||x['@graph'])));
    check(name+'_author_metadata',metadata.author==='Natacsha Ordones Raposo de Melo');
    const navigation=await page.locator('header.site-header .nav a').allInnerTexts();
    check(name+'_shared_navigation',JSON.stringify(navigation.map(x=>x.trim()))===JSON.stringify(['Entenda a MADO','A ontologia','Experimente o AMADO']));
    check(name+'_single_current_navigation',await page.locator('header.site-header .nav a[aria-current="page"]').count()===1);
    check(name+'_shared_shell_loaded',await page.locator('link[rel="stylesheet"][href$="shell.css"]').count()===1);
    check(name+'_no_positive_tabindex',await page.locator('[tabindex]').evaluateAll(nodes=>nodes.every(x=>Number(x.getAttribute('tabindex'))<=0)));
    await page.keyboard.press('Tab');
    const skip=await page.evaluate(()=>({href:document.activeElement?.getAttribute('href'),name:document.activeElement?.textContent}));
    check(name+'_skip_link_first',skip.href?.startsWith('#')&&/conteúdo/i.test(skip.name));
    await page.keyboard.press('Enter');
    check(name+'_skip_link_focus',await page.evaluate(()=>document.activeElement===document.querySelector('main')));

    {
      const toolbar=page.locator('[data-site-accessibility]');
      check(name+'_toolbar_present',await toolbar.count()===1);
      const selectors=['[data-font-increase]','[data-font-decrease]','[data-font-reset]','[data-site-contrast]'];
      check(name+'_native_named_buttons',await page.locator(selectors.join(',')).evaluateAll(nodes=>nodes.length===4&&nodes.every(x=>x.tagName==='BUTTON'&&x.type==='button'&&Boolean(x.textContent.trim()||x.getAttribute('aria-label')))));
      await keyboardFocus('[data-font-increase]');
      const focus=await focusSample('[data-font-increase]');report.pages[name].focus=focus;
      check(name+'_keyboard_visible_focus',focus.visible&&focus.in_view&&focus.outline_style!=='none'&&parseFloat(focus.outline_width)>=2);
      const originalSize=await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      report.pages[name].font_base=originalSize;
      check(name+'_preserved_font_base',originalSize===(name==='amado'?18:16));
      await page.keyboard.press('Enter');
      check(name+'_keyboard_text_enlargement',await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>originalSize);
      for(let n=0;n<25;n++)if(await page.locator('[data-font-increase]').isEnabled())await page.locator('[data-font-increase]').click();
      const enlarged=await page.locator('html').evaluate(el=>({style:el.style.fontSize,pixels:parseFloat(getComputedStyle(el).fontSize)}));
      report.pages[name].font_200=enlarged;
      check(name+'_text_200_percent',Math.abs(enlarged.pixels/originalSize-2)<.02);
      await assertReflow(name+'_text_200_reflow');
      await page.locator('[data-font-reset]').click();
      check(name+'_font_reset',await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))===originalSize);
      for(let n=0;n<15;n++)if(await page.locator('[data-font-decrease]').isEnabled())await page.locator('[data-font-decrease]').click();
      check(name+'_font_not_below_100',await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))===originalSize);
      const live=await page.locator('[data-reading-status]').evaluate(el=>({role:el.getAttribute('role'),live:el.getAttribute('aria-live')}));
      check(name+'_status_semantics',live.role==='status'||live.live==='polite');
      report.pages[name].contrast_default=await textSamples();
      check(name+'_contrast_default',report.pages[name].contrast_default.length>8&&report.pages[name].contrast_default.every(x=>x.ratio>=x.minimum));
      await keyboardFocus('[data-site-contrast]');await page.keyboard.press('Space');
      check(name+'_contrast_keyboard_toggle',await page.locator('html').getAttribute('data-contrast')==='high'&&await page.locator('[data-site-contrast]').getAttribute('aria-pressed')==='true');
      report.pages[name].contrast_high=await textSamples();
      check(name+'_contrast_high',report.pages[name].contrast_high.every(x=>x.ratio>=x.minimum));
      await page.screenshot({path:path.join(artifacts,name+'-contrast.png')});
      await page.locator('[data-site-contrast]').click();
      await page.locator('[data-site-top]').focus();await page.keyboard.press('Enter');await settled();
      check(name+'_top_link_focus',await page.evaluate(()=>document.activeElement?.id==='inicio'));
    }
    if(name==='amado'){
      const homeLink=page.locator('header').getByRole('link',{name:'Entenda a MADO',exact:true});
      check('amado_home_navigation',await homeLink.count()===1);
      const href=await homeLink.getAttribute('href');
      check('amado_home_subpath',new URL(href,page.url()).pathname==='/MADO/');
      const top=page.getByRole('link',{name:/Voltar ao (?:topo|início)/i});
      check('amado_top_link',await top.count()===1);
      await top.focus();await page.keyboard.press('Enter');await settled();
      check('amado_top_focus',await page.evaluate(()=>['inicio','page-title'].includes(document.activeElement?.id)));
      report.pages[name].contrast_default=await textSamples();
      check('amado_contrast_sample',report.pages[name].contrast_default.every(x=>x.ratio>=x.minimum));
    }
    if(name==='home'){
      const body=await page.locator('body').innerText();
      report.pages[name].technical_terms_visible=body.match(/\b(?:RDF|OWL|SHACL|SPARQL|Pyodide|K\d{2}|CA\d{2}|ART-[A-Z]+-\d+)\b/g)||[];
      check('home_no_unexplained_identifiers',report.pages[name].technical_terms_visible.length===0);
    }
    if(name!=='amado'){
      const text=await page.locator('body').innerText();
      check(name+'_authorship_and_acronym',text.includes('Natacsha Ordones Raposo de Melo')&&text.includes('Multimodal Accessibility Decision Ontology'));
      check(name+'_authorial_voice',name==='home'?text.includes('construí a MADO'):text.includes('representei conceitos'));
      const card=page.locator(name==='home'?'main .card':'main .terms>div').first();
      const snapshot=()=>card.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,transform:s.transform,border:s.borderColor,shadow:s.boxShadow,transition:s.transitionDuration,tabindex:el.getAttribute('tabindex')};});
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.mouse.move(0,0);await settled();const before=await snapshot();
      await card.hover();await card.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
      const hovered=await snapshot();report.pages[name].hover={before,hovered};
      check(name+'_hover_keeps_content_geometry',Math.abs(hovered.width-before.width)<1&&Math.abs(hovered.height-before.height)<1);
      check(name+'_subtle_hover_not_focusable',hovered.transform==='matrix(1, 0, 0, 1, 0, -3)'&&hovered.tabindex===null);
      await page.emulateMedia({reducedMotion:'reduce'});await settled();
      const reduced=await snapshot();report.pages[name].hover.reduced=reduced;
      check(name+'_hover_respects_reduced_motion',reduced.transform==='none'&&reduced.transition.split(',').every(x=>parseFloat(x)===0));
    }
    await page.screenshot({path:path.join(artifacts,name+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:320,height:900});
    await assertReflow(name+'_reflow_320');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await settled();
    await page.screenshot({path:path.join(artifacts,name+'-mobile.png'),fullPage:true});
    await page.screenshot({path:path.join(artifacts,name+'-mobile-viewport.png')});
    {
      for(let n=0;n<25;n++)if(await page.locator('[data-font-increase]').isEnabled())await page.locator('[data-font-increase]').click();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await settled();
      await page.screenshot({path:path.join(artifacts,name+'-mobile-200.png')});
      await assertReflow(name+'_mobile_text_200_reflow');
      await page.locator('h1').screenshot({path:path.join(artifacts,name+'-mobile-200-title.png')});
      await page.locator('[data-font-reset]').click();
    }
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
    await assertReflow(name+'_forced_colors_reflow');
    check(name+'_forced_colors_and_reduced_motion',await page.evaluate(()=>matchMedia('(forced-colors:active)').matches&&matchMedia('(prefers-reduced-motion:reduce)').matches&&getComputedStyle(document.documentElement).scrollBehavior==='auto'));
    await page.screenshot({path:path.join(artifacts,name+'-forced-colors.png'),fullPage:true});
    check(name+'_no_persistent_storage',await page.evaluate(async()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===''&&(await indexedDB.databases()).length===0&&(await caches.keys()).length===0));
    await page.emulateMedia({forcedColors:'none'});
    {
      await page.locator('[data-font-increase]').click();await page.locator('[data-site-contrast]').click();await page.reload();
      if(name==='amado')await idle();
      check(name+'_preferences_not_restored',await page.locator('html').getAttribute('data-contrast')!=='high'&&await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))===(name==='amado'?18:16));
    }
  }
  check('distinct_page_titles',new Set(titles).size===3);
  const sitemapResponse=await context.request.get(base+'sitemap.xml');
  const sitemap=await sitemapResponse.text();
  report.sitemap_urls=[...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(x=>x[1]);
  check('sitemap_three_pages',sitemapResponse.status()===200&&['','ontologia/','amado/'].every(rel=>report.sitemap_urls.includes(publicBase+rel)));
  // A robots.txt under /MADO/ cannot govern the host. The project controls
  // the sitemap, not the root-level robots policy of the Pages host.
  report.robots={status:'NOT_ASSERTED',reason:'robots.txt deve estar na raiz da origem; o projeto está em /MADO/. Submissão do sitemap ao mecanismo de busca é uma etapa externa.'};
  check('no_external_requests_or_case_post',report.external_requests.length===0&&report.request_methods.every(x=>x==='GET'));
  check('no_javascript_errors',report.errors.length===0);
  report.completed=true;
}catch(error){report.completed=false;report.failure=error.message;console.error(error);process.exitCode=1;}
finally{
  report.finished_at_utc=new Date().toISOString();
  const reportName=process.env.AMADO_SITE_URL?'site-public-report.json':'site-presentation-report.json';
  const output=path.join(root,'evidence',reportName);
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server.close(resolve));
  console.log(JSON.stringify({completed:report.completed,checks_passed:Object.values(report.checks).filter(x=>x===true).length,checks_total:Object.keys(report.checks).length,report:'evidence/'+reportName,failure:report.failure}));
}
