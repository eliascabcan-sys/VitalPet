import json, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
RUTAS = ["/dueno/inicio","/dueno/mascotas","/dueno/agregar-mascota","/dueno/citas","/dueno/historial",
         "/dueno/carnet","/dueno/reporte","/dueno/seguimiento","/dueno/triaje","/login","/registro","/"]
VIEWS = {"iphone-375": {"width":375,"height":812}, "android-360": {"width":360,"height":740}}
TAG = sys.argv[1] if len(sys.argv)>1 else "antes"

JS = r"""
() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if(!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const over = (f,b) => ({r:f.r*f.a+b.r*(1-f.a), g:f.g*f.a+b.g*(1-f.a), b:f.b*f.a+b.b*(1-f.a), a:1});
  const lum = c => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const cr = (a,b) => { let x=lum(a),y=lum(b); if(x<y)[x,y]=[y,x]; return (x+0.05)/(y+0.05); };
  const bgDe = el => { let stack=[]; let n=el, unknown=false;
    while(n && n.nodeType===1){ const cs=getComputedStyle(n);
      if(cs.backgroundImage && cs.backgroundImage!=='none') unknown=true;
      const c=parse(cs.backgroundColor); if(c && c.a>0) { stack.push(c); if(c.a>=1) break; } n=n.parentElement; }
    let base={r:255,g:255,b:255,a:1}; for(let i=stack.length-1;i>=0;i--) base=over(stack[i],base); return {base,unknown}; };
  const visible = el => { const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return r.width>0 && r.height>0 && cs.visibility!=='hidden' && cs.display!=='none' && parseFloat(cs.opacity)>0; };
  const sel = el => { let s=el.tagName.toLowerCase(); if(el.id) s+='#'+el.id; if(el.className && typeof el.className==='string') s+='.'+el.className.trim().split(/\s+/).slice(0,2).join('.'); return s; };
  const out = {chicas:[], contraste:[], overflow:null, tap:[], inputs:[]};
  const W = window.innerWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth > W+1) { out.overflow = doc.scrollWidth; }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set(); let n;
  while(n = walker.nextNode()){
    const t = n.textContent.trim(); if(!t) continue; const el = n.parentElement; if(!el || vistos.has(el)) continue;
    if(['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) continue;
    if(!visible(el)) continue; vistos.add(el);
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    if(fs < 14 && !el.matches('i,.ti,[class*="bi-"]')) out.chicas.push({el: sel(el), px: fs, texto: t.slice(0,40)});
    const fg = parse(cs.color); const {base, unknown} = bgDe(el);
    if(fg){ const f = over({...fg, a: fg.a*parseFloat(cs.opacity)}, base); const ratio = cr(f, base);
      const grande = fs>=24 || (fs>=18.66 && parseInt(cs.fontWeight)>=700); const min = grande?3:4.5;
      if(ratio < min) out.contraste.push({el: sel(el), ratio: +ratio.toFixed(2), px: fs, desconocido: unknown, texto: t.slice(0,40)}); }
  }
  document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button]').forEach(el=>{
    if(!visible(el)) return; const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if(el.matches('input,select,textarea') && parseFloat(cs.fontSize) < 16) out.inputs.push({el: sel(el), px: parseFloat(cs.fontSize)});
    if(r.height < 43.5 && !(el.tagName==='A' && cs.display==='inline' )) out.tap.push({el: sel(el), h: Math.round(r.height), w: Math.round(r.width), texto: (el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,30)});
  });
  return out;
}
"""

res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for vname, vp in VIEWS.items():
        ctx = b.new_context(viewport=vp, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.route("**/*", lambda r: r.abort() if r.request.url.startswith("http") and "localhost" not in r.request.url else r.continue_())
        pg.goto(BASE+"/login"); 
        pg.evaluate("""()=>{localStorage.setItem('vp_token','mock-token');localStorage.setItem('vp_usuario_id','101');
          localStorage.setItem('vp_nombre','Laura');localStorage.setItem('vp_apellido','Gómez');localStorage.setItem('vp_rol','dueno');localStorage.setItem('vp_email','laura.gomez@demo.co');}""")
        for ruta in RUTAS:
            pg.goto(BASE+ruta); pg.wait_for_timeout(1200)
            try:
                r = pg.evaluate(JS)
            except Exception as e:
                r = {"error": str(e)[:200]}
            res[f"{vname}{ruta}"] = r
            nombre = ruta.strip("/").replace("/","_") or "home"
            pg.screenshot(path=f"./auditoria-salida/{TAG}_{vname}_{nombre}.png", full_page=False)
        ctx.close()
    b.close()
json.dump(res, open(f"./auditoria-salida/{TAG}.json","w"), ensure_ascii=False, indent=1)
tot = {"chicas":0,"contraste":0,"tap":0,"inputs":0,"overflow":0}
for k,v in res.items():
    if "error" in v: print(k, v); continue
    print(f"{k:34s} chicas={len(v['chicas']):3d} contraste={len(v['contraste']):3d} tap<44={len(v['tap']):3d} input<16={len(v['inputs']):2d} overflowX={v['overflow']}")
    for c in tot: 
        if c=="overflow": tot[c]+= 1 if v['overflow'] else 0
        else: tot[c]+=len(v[c])
print("TOTAL", tot)
