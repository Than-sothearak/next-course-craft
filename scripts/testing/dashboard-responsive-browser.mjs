/** Actual dashboard components at phone/tablet widths, using isolated fixture data. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';
import DashboardClient from'/app/dashboard/dashboard-client.tsx';
import{DashboardProvider}from'/app/dashboard/_components/dashboard-provider.tsx';
import{DashboardNavigationClient}from'/app/dashboard/_components/dashboard-navigation-client.tsx';
import{DashboardNavbar}from'/app/dashboard/_components/dashboard-navbar.tsx';
import{DashboardSkeleton}from'/app/dashboard/_components/dashboard-skeletons.tsx';
import{dashboardFilters}from'/lib/dashboard/query.ts';
import{Button}from'/components/ui/button.tsx';import'/app/globals.css';
import{PublishMenu}from'/components/publish-menu.tsx';
const permissions=['courses.create','courses.edit','courses.assign','courses.publish','courses.export','courses.delete','workspaces.manage'];
const nested={id:'training',name:'Team training resources and documentation',courseCount:6,children:[{id:'nested',name:'Nested training resources',courseCount:3,children:[{id:'deep',name:'Detailed learning materials '+ 'x'.repeat(100),courseCount:2,children:[]}]}]};
const courses=Array.from({length:6},(_,i)=>({id:'course-'+i,title:i===0?'Advanced learning design with detailed course descriptions and practical exercises':i===1?'VeryLongCourseTitle'.repeat(12):'Course '+(i+1),description:i===1?'Description'.repeat(60):'Create useful learning experiences for your team. រៀនជាមួយគ្នា',coverImage:null,courseLayout:i%2?'slides':'standard',folderId:null,status:i%2?'published':'draft',revision:1,updatedAt:'2026-11-03T00:00:00Z',lessonCount:12,accessRole:'owner',permissions}));
function App(){const[filters,setFilters]=useState(()=>dashboardFilters(Object.fromEntries(new URLSearchParams(location.search)))),[editorNav,setEditorNav]=useState(false),[skeleton,setSkeleton]=useState(false);useEffect(()=>{const update=()=>setFilters(dashboardFilters(Object.fromEntries(new URLSearchParams(location.search))));window.addEventListener('fixture-route',update);return()=>window.removeEventListener('fixture-route',update);},[]);
const data={currentFolder:null,breadcrumbs:[{id:null,name:'All courses'},...(filters.folderId?[{id:filters.folderId,name:'Selected training folder'}]:[])],folders:[{id:'training',name:'Team training resources and documentation',parentId:null,courseCount:6,subfolderCount:1,createdAt:'2026-11-03',updatedAt:'2026-11-03'}],folderOptions:[{id:'training',label:'Team training',depth:0}],folderTree:[nested],courses,workspaces:[{id:'team',name:'Learning and development team with a very long workspace name',role:'owner',memberCount:4}],workspaceId:filters.workspaceId,workspaceName:filters.workspaceId?'Learning and development team with a very long workspace name':'Personal',workspaceRole:'owner',permissions};
window.__data=data;window.__filters=filters;
if(skeleton)return <><button onClick={()=>setSkeleton(false)}>Exit skeleton</button><DashboardSkeleton/></>;
return <main className="flex min-h-screen flex-col bg-[#f7f8fc]"><DashboardNavbar userName="Mobile Author" actions={editorNav?<><Button variant="ghost" size="icon" aria-label="Back">←</Button><Button variant="ghost" size="icon" aria-label="Forward">→</Button></>:undefined} primaryAction={editorNav?<div className="flex items-center gap-2"><span className="whitespace-nowrap">All changes saved</span>{['Undo','Redo','Generate course'].map(label=><Button key={label}>{label}</Button>)}<PublishMenu courseId="test" title="Test course"/></div>:undefined}/><DashboardProvider key={JSON.stringify(filters)} initialFilters={filters}><div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)]"><DashboardNavigationClient initialNavigation={data} initialError={null}/><DashboardClient initialData={data} initialError={null} userName="MobileAuthorWithAVeryLongUnbrokenName"/></div></DashboardProvider><footer className="p-4"><Button onClick={()=>setEditorNav(value=>!value)}>Toggle editor navbar</Button><Button onClick={()=>setSkeleton(true)}>Show loading skeleton</Button></footer></main>};createRoot(document.getElementById('root')).render(<App/>);`;
const link = `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({children,prefetch,...props}){return React.createElement('a',{...props,onClick:event=>{props.onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&String(props.href).startsWith('/dashboard')){event.preventDefault();window.__push(String(props.href));}}},children)}`;
const navigation = `export function useRouter(){return{push:href=>window.__push(href),refresh(){},back(){},forward(){}}}`;
const vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-dashboard-responsive", define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic", loader: "tsx", include: /\.[jt]sx?$/ }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge", "next/image"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "dashboard-fixture", enforce: "pre", resolveId(id, importer) {
  if (id === "/__dashboard.tsx") return id;
  if (id === "next/link") return "\0fixture-link.tsx";
  if (id === "next/navigation") return "\0fixture-navigation";
  if (id === "../actions" && importer?.includes('dashboard-navbar')) return "\0fixture-actions";
}, load(id) {
  if (id === "/__dashboard.tsx") return fixture;
  if (id === "\0fixture-link.tsx") return link;
  if (id === "\0fixture-navigation") return navigation;
  if (id === "\0fixture-actions") return 'export async function signOutAction(){}';
}, configureServer(server) { server.middlewares.use((request, response, next) => { if (!request.url?.startsWith('/__dashboard') || request.url.startsWith('/__dashboard.tsx')) return next(); response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__dashboard.tsx"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ hasTouch: true }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: 'development' } }; window.__push = href => { history.pushState(null, '', href); window.dispatchEvent(new Event('fixture-route')); }; });
  await page.route('**/api/dashboard?*', async route => route.fulfill({ json: await page.evaluate(() => window.__data) }));
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  mkdirSync('test-results', { recursive: true });
  for (const [width, height] of [[320,568],[390,844],[640,800],[768,1024],[844,390],[1024,768],[1280,900],[1536,1000]]) {
    await page.setViewportSize({width,height}); await page.goto(`${origin}/__dashboard`);
    await page.getByRole('heading', {name:'Courses',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Dashboard fits at ${width}px`);
    const cards = page.locator('article:has(.aspect-video)'); assert.equal(await cards.count(),6);
    const cardBounds = await cards.first().boundingBox(); assert.ok(cardBounds.width >= 250,`Cards stay readable at ${width}px`);
    if(width>=640){
      const statusRows=await cards.evaluateAll(elements=>elements.slice(0,2).map(element=>({top:element.getBoundingClientRect().top,status:element.querySelector('.border-t').getBoundingClientRect().top})));
      if(statusRows[0].top===statusRows[1].top)assert.ok(Math.abs(statusRows[0].status-statusRows[1].status)<1,'Card metadata aligns across the row');
    }
    const actions = cards.first().getByRole('link', {name:/Open editor/});
    const share = cards.first().getByRole('link', {name:'Share access',exact:true});
    const a = await actions.boundingBox(), b = await share.boundingBox();
    assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y,'Card actions never overlap');
    await cards.last().getByRole('button', {name:/^Manage /}).tap();
    const settings = page.getByRole('dialog',{name:'Course settings',exact:true}); await settings.waitFor();
    const settingsBounds=await settings.boundingBox(); assert.ok(settingsBounds.x>=0&&settingsBounds.x+settingsBounds.width<=width);
    await page.keyboard.press('Escape');
    if(width<1024){
      await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).tap();
      const dialog=page.getByRole('dialog',{name:'Folders & workspaces',exact:true}); await dialog.waitFor();
      if(width===390)await page.screenshot({path:'test-results/dashboard-mobile-folders.png'});
      const bounds=await dialog.boundingBox(); assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height<=height);
      assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth),true,'Folder tree fits inside its panel');
      assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
      await dialog.getByRole('button',{name:'Collapse Team training resources and documentation',exact:true}).tap();
      assert.equal(await dialog.getByRole('link',{name:/Nested training resources/}).count(),0);
      await dialog.getByRole('button',{name:'Expand Team training resources and documentation',exact:true}).tap();
      await dialog.getByRole('link',{name:/Nested training resources/}).tap();
      await page.waitForFunction(()=>window.__filters.folderId==='nested');
      assert.equal(await page.getByRole('dialog',{name:'Folders & workspaces',exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
      await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).tap();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).evaluate(element=>element===document.activeElement),true,'Escape restores focus to the menu trigger');
    } else assert.equal(await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).isVisible(),false);
    await page.getByRole('button',{name:'Toggle editor navbar',exact:true}).click();
    await page.evaluate(()=>scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Navbar fits at ${width}px`);
    await page.locator('header').getByRole('button',{name:'Publish',exact:true}).tap();
    const publishMenu=page.getByRole('menu',{name:'Publish format',exact:true}), publishBounds=await publishMenu.boundingBox();
    assert.ok(publishBounds.x>=0&&publishBounds.x+publishBounds.width<=width,'The navbar Publish menu fits the screen');
    assert.equal(await publishMenu.getByRole('menuitem',{name:'SCORM 2004',exact:true}).evaluate(element=>{const bounds=element.getBoundingClientRect();return element.contains(document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2));}),true,'Navbar dropdowns stay clickable without overflow clipping');
    await page.keyboard.press('Escape');
    const profile = page.locator('header summary'); await profile.tap();
    assert.equal(await page.getByRole('link',{name:'Account status',exact:true}).isVisible(),true);
    await profile.tap();
    if(width===390||width===768||width===1280)await page.screenshot({path:`test-results/dashboard-responsive-${width}.png`});
    await page.getByRole('button',{name:'Show loading skeleton',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Loading layout fits at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844}); await page.goto(`${origin}/__dashboard`);
  await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).tap();
  await page.getByRole('dialog',{name:'Folders & workspaces',exact:true}).getByRole('button',{name:'Create folder',exact:true}).tap();
  await page.getByRole('dialog',{name:'Create a folder',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).tap();
  await page.getByRole('dialog',{name:'Folders & workspaces',exact:true}).getByLabel('Switch workspace',{exact:true}).selectOption('team');
  await page.waitForFunction(()=>window.__filters.workspaceId==='team'&&window.__filters.folderId===null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Long team workspace names stay within the phone viewport');
  await page.getByRole('button',{name:'Open folders and workspaces',exact:true}).tap();
  await page.setViewportSize({width:1280,height:900});
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
  assert.deepEqual(errors,[]);
  console.log('Dashboard responsive browser checks passed: 320–1536px layouts, readable cards, nonoverlapping actions, popovers, navbar/profile controls, mobile folder tree, touch navigation, workspace switching, creation actions, Escape/focus restoration, desktop resizing, and loading states.');
} finally { await browser?.close(); await vite.close(); }
