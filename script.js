/* RCSprints — catalog, cart, calculator, forms, and local admin tools */
(() => {
  "use strict";
  const FORM_ENDPOINT = "https://formspree.io/f/xzeerwej";
  const CLOUDINARY = {cloudName:"dzp0rzb7", uploadPreset:"rcsprints"};
  const ADMIN_PASSWORD = "RCS26prints"; // Static-site password only; not secure authentication.
  const STORAGE = {prints:"rcsprints_prints_v2", colors:"rcsprints_colors_v2", cart:"rcsprints_cart_v2"};
  const builtinPrints = [
    {id:1,title:"Articulated Crystal Dragon",price:"$24.99",image:"",desc:"A flexible articulated print with smooth movement and plenty of character.",featured:true},
    {id:2,title:"Geometric Headphone Stand",price:"$18.50",image:"",desc:"A clean desk stand designed to keep headphones close and organized.",featured:true},
    {id:3,title:"Modular Grid Organizer",price:"$15.00",image:"",desc:"Interlocking storage bins for tools, parts, and small everyday items.",featured:true},
    {id:4,title:"Cyberpunk Desk Planter",price:"$12.99",image:"",desc:"A geometric planter with a modern look for a small desk or shelf.",featured:false},
    {id:5,title:"Hexagon Wall Light Panels",price:"$32.00",image:"",desc:"Modular hexagon panels designed for creative lighting setups.",featured:false},
    {id:6,title:"Miniature Gaming Dice Tower",price:"$21.00",image:"",desc:"A tabletop dice tower for game nights and display shelves.",featured:false},
    {id:7,title:"Custom Phone & Tablet Dock",price:"$14.50",image:"",desc:"A compact viewing stand with room to route a charging cable.",featured:false},
    {id:8,title:"Lithophane Photo Lamp",price:"$39.99",image:"",desc:"A personalized keepsake that turns a favorite photo into a lamp.",featured:false},
    {id:9,title:"Mechanical Gear Fidget Toy",price:"$9.99",image:"",desc:"An engaging mechanical-style fidget print with moving gear details.",featured:false},
    {id:10,title:"Architectural Bridge Model",price:"$45.00",image:"",desc:"A detailed scale model for display, learning, or architecture fans.",featured:false}
  ];
  const CFG = window.RCS_CONFIG || {};
  const defaultPrints = Array.isArray(CFG.prints) ? CFG.prints : builtinPrints;
  const builtinColors = "PLA - Matte Black, PLA - Forest Green, PLA - Silk Gold, PLA - White, PETG - Cool Grey, TPU - Flexible Orange";
  const defaultColors = (typeof CFG.colors==="string"&&CFG.colors.trim()) ? CFG.colors : builtinColors;
  const $ = id => document.getElementById(id);
  const safeParse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readStorage = (key, fallback) => { try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { showStatus("Could not save changes","Browser storage is full or unavailable. Try a smaller image or clear site data."); return false; } };
  let prints = readStorage(STORAGE.prints, defaultPrints);
  let colors = (() => { try { return localStorage.getItem(STORAGE.colors) || defaultColors; } catch { return defaultColors; } })();
  let cart = readStorage(STORAGE.cart, []);
  let adminUnlocked = false;
  // ----- Homepage design state (see "Homepage editor" below) -----
  const HOME_KEY="rcsprints_home_v1";
  const HOME_DEFAULTS = CFG.home || {};
  function deepMerge(a,b){ const o=JSON.parse(JSON.stringify(a||{})); (function m(t,s){ for(const k in s){ if(s[k]&&typeof s[k]==="object"&&!Array.isArray(s[k])){ t[k]=(t[k]&&typeof t[k]==="object")?t[k]:{}; m(t[k],s[k]); } else t[k]=s[k]; } })(o,b||{}); return o; }
  let home = deepMerge(HOME_DEFAULTS, readStorage(HOME_KEY,{}));

  function colorList(){ return colors.split(",").map(c=>c.trim()).filter(Boolean); }
  function priceNumber(value){ return Number.parseFloat(String(value).replace(/[^0-9.]/g,"")) || 0; }
  function placeholder(title){
    const label = escapeHTML(title).slice(0,45);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#0b1611"/><path d="M220 145l80-45 80 45v100l-80 45-80-45z" fill="none" stroke="#3b8a59" stroke-width="4"/><path d="M220 145l80 50 80-50M300 195v95" fill="none" stroke="#79d69a" stroke-width="4"/><text x="300" y="350" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#e6eee8">${label}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }
  function imageFor(print){ return print.image || placeholder(print.title); }
  function setPage(name, section){
    const target = document.querySelector(`[data-page-panel="${name}"]`);
    if(!target) name = "home";
    document.querySelectorAll("[data-page-panel]").forEach(p=>p.classList.toggle("active",p.dataset.pagePanel===name));
    document.querySelectorAll(".nav-link[data-page]").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
    $("nav-links").classList.remove("open"); $("menu-toggle").setAttribute("aria-expanded","false");
    if(name!=="admin" && adminUnlocked) lockAdmin();
    if(section){
      setTimeout(()=>{ const el=$(section); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },60);
    } else window.scrollTo({top:0,behavior:"smooth"});
  }
  function routeClick(event){
    const link = event.target.closest("[data-page],[data-section]");
    if(!link) return;
    const page = link.dataset.page;
    const section = link.dataset.section;
    if(!page && !section) return;
    event.preventDefault();
    if(section) setPage("store",section); else setPage(page);
    const next=section ? "#"+section : "#"+page; if(location.hash!==next) history.pushState(null,"",next);
  }
  function renderColors(){
    const select=$("custom-color");
    if(select) select.innerHTML = colorList().map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("") || '<option value="Not specified">Not specified</option>';
  }
  function productCard(p, index, featured=false){
    const colorOptions=colorList().map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
    return `<article class="product-card">
      <div class="product-image"><img loading="lazy" src="${escapeHTML(imageFor(p))}" alt="${escapeHTML(p.title)}"><span class="product-tag">${featured?"Featured":"Print slot "+(index+1)}</span></div>
      <div class="product-body"><div class="product-title-row"><h3>${escapeHTML(p.title)}</h3><span class="product-price">${escapeHTML(p.price)}</span></div>
      <p class="product-desc">${escapeHTML(p.desc)}</p>
      <div class="product-controls"><label class="field-label">Material / color<select data-color-for="${p.id}">${colorOptions || '<option>Standard</option>'}</select></label>
      <div class="product-actions"><button class="button button-primary" data-buy="${p.id}">Order print ↗</button><button class="button button-outline" data-add="${p.id}">+ Add to cart</button></div></div></div></article>`;
  }
  function renderCatalog(){
    const search=($("product-search")?.value || "").trim().toLowerCase();
    const filtered=prints.filter(p=>(p.title+" "+p.desc).toLowerCase().includes(search));
    $("store-grid").innerHTML=filtered.map(p=>productCard(p,prints.indexOf(p))).join("");
    $("product-count").textContent=`${filtered.length} print${filtered.length===1?"":"s"}`;
    $("no-results").classList.toggle("hidden",filtered.length!==0);
    $("featured-grid").innerHTML=prints.filter(p=>p.featured).slice(0,Math.min(6,Math.max(1,Number(home.featuredCount)||3))).map(p=>productCard(p,prints.indexOf(p),true)).join("");
    renderColors(); renderCart();
  }
  function persistPrints(){ writeStorage(STORAGE.prints,prints); renderCatalog(); if(adminUnlocked) renderAdminSlots(); }
  function calculate(){
    const h=Math.max(0,Number.parseFloat($("calc-hours").value)||0);
    const g=Math.max(0,Number.parseFloat($("calc-grams").value)||0);
    const total=Math.max(1,Math.round((h+g)*.15));
    $("calc-total").textContent="$"+total; return total;
  }
  function openCart(){
    $("cart-drawer").classList.add("open"); $("cart-drawer").setAttribute("aria-hidden","false"); $("cart-drawer").removeAttribute("inert");
    $("cart-overlay").classList.remove("hidden"); requestAnimationFrame(()=>$("cart-overlay").classList.add("visible"));
    $("close-cart").focus();
  }
  function closeCart(){
    $("cart-drawer").classList.remove("open"); $("cart-drawer").setAttribute("aria-hidden","true"); $("cart-drawer").setAttribute("inert","");
    $("cart-overlay").classList.remove("visible"); setTimeout(()=>$("cart-overlay").classList.add("hidden"),250);
    $("open-cart").focus();
  }
  function addToCart(id,card){
    const p=prints.find(item=>item.id===id); if(!p) return;
    const select=(card&&card.querySelector("[data-color-for]"))||document.querySelector(`[data-color-for="${id}"]`);
    const color=select?.value || colorList()[0] || "Standard";
    const existing=cart.find(i=>i.id===id&&i.color===color);
    if(existing) existing.qty++; else cart.push({id,title:p.title,price:p.price,color,qty:1});
    writeStorage(STORAGE.cart,cart); renderCart(); openCart();
  }
  function changeQty(id,color,delta){
    const item=cart.find(i=>i.id===id&&i.color===color); if(!item) return;
    item.qty+=delta; if(item.qty<=0) cart=cart.filter(i=>i!==item);
    writeStorage(STORAGE.cart,cart); renderCart();
  }
  function renderCart(){
    const count=cart.reduce((n,i)=>n+Math.max(0,Number(i.qty)||0),0);
    const total=cart.reduce((n,i)=>n+priceNumber(i.price)*Math.max(0,Number(i.qty)||0),0);
    $("cart-count").textContent=count; $("cart-total").textContent="$"+total.toFixed(2);
    $("cart-items").innerHTML=cart.length?cart.map(i=>`<div class="cart-item"><div><strong>${escapeHTML(i.title)}</strong><small>${escapeHTML(i.color)} · ${escapeHTML(i.price)} each</small></div><div class="qty-controls"><button data-qty="-1" data-id="${i.id}" data-color="${escapeHTML(i.color)}" aria-label="Remove one ${escapeHTML(i.title)}">−</button><span>${i.qty}</span><button data-qty="1" data-id="${i.id}" data-color="${escapeHTML(i.color)}" aria-label="Add one ${escapeHTML(i.title)}">+</button></div></div>`).join(""):'<p class="cart-empty">Your cart is empty.<br>Pick a print to get started.</p>';
  }
  function showStatus(title,message){ $("status-title").textContent=title; $("status-message").textContent=message; $("status-modal").classList.remove("hidden"); $("close-status").focus(); }
  function closeStatus(){ $("status-modal").classList.add("hidden"); }
  async function sendForm(data,button,defaultLabel){
    button.disabled=true; button.textContent="Sending…";
    try{
      const response=await fetch(FORM_ENDPOINT,{method:"POST",body:data,headers:{Accept:"application/json"}});
      if(!response.ok) throw new Error("The form service did not accept the request.");
      return true;
    }catch(error){ showStatus("Could not send request","Please check your connection and try again. If the issue continues, contact the site owner."); return false; }
    finally{button.disabled=false;button.textContent=defaultLabel;}
  }
  function unlockAdmin(){
    adminUnlocked=true; $("admin-login").classList.add("hidden"); $("admin-dashboard").classList.remove("hidden");
    $("colors-input").value=colors; renderAdminSlots(); renderHomeEditor(); setupPreview();
  }
  function lockAdmin(){ adminUnlocked=false; $("admin-login").classList.remove("hidden"); $("admin-dashboard").classList.add("hidden"); $("admin-password").value=""; }
  function renderAdminSlots(){
    if(!adminUnlocked) return;
    if(!prints.length){ $("admin-slots").innerHTML='<p class="muted">No print slots yet. Click “+ Add print slot” to create one.</p>'; return; }
    $("admin-slots").innerHTML=prints.map((p,i)=>`<article class="admin-slot" data-slot="${p.id}">
      <div class="admin-slot-head"><strong>Slot #${i+1}</strong><span class="slot-actions"><label class="check-label"><input type="checkbox" data-field="featured" data-index="${i}" ${p.featured?"checked":""}> Featured</label><button type="button" class="button button-outline slot-remove" data-remove-slot="${i}">Remove slot</button></span></div>
      <div class="form-row"><label>Title<input data-field="title" data-index="${i}" value="${escapeHTML(p.title)}"></label><label>Price<input data-field="price" data-index="${i}" value="${escapeHTML(p.price)}"></label></div>
      <label>Description<textarea rows="2" data-field="desc" data-index="${i}">${escapeHTML(p.desc)}</textarea></label>
      <div class="photo-upload"><img class="photo-thumb" src="${escapeHTML(imageFor(p))}" alt=""><div class="photo-upload-controls"><label>Upload photo from your computer<input type="file" accept="image/*" data-upload="${i}"></label><button type="button" class="button button-outline" data-clear-photo="${i}">Remove photo</button></div></div>
      <label>Or photo URL / repository path<input data-field="image" data-index="${i}" value="${escapeHTML(String(p.image||"").startsWith("data:")?"":p.image)}" placeholder="${String(p.image||"").startsWith("data:")?"Uploaded photo in use":"assets/your-photo.jpg"}"></label>
    </article>`).join("");
  }
  function saveColors(){ colors=$("colors-input").value.split(",").map(c=>c.trim()).filter(Boolean).join(", "); try{localStorage.setItem(STORAGE.colors,colors);}catch{} renderColors(); renderCatalog(); showStatus("Materials saved","Available material and color options were updated in this browser."); }

  document.addEventListener("click",routeClick);
  $("menu-toggle").addEventListener("click",()=>{const open=$("nav-links").classList.toggle("open");$("menu-toggle").setAttribute("aria-expanded",String(open));});
  $("open-cart").addEventListener("click",openCart); $("close-cart").addEventListener("click",closeCart); $("cart-overlay").addEventListener("click",closeCart);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("cart-drawer").classList.contains("open"))closeCart();closeStatus();}});
  $("close-status").addEventListener("click",closeStatus);
  $("product-search").addEventListener("input",renderCatalog);
  $("calc-hours").addEventListener("input",calculate); $("calc-grams").addEventListener("input",calculate);
  $("use-estimate").addEventListener("click",()=>{$("custom-notes").value=`Estimated quote: $${calculate()} (${ $("calc-hours").value||0 } hours, ${ $("calc-grams").value||0 } grams). `;setPage("store","custom-order");});
  document.addEventListener("click",e=>{
    const buy=e.target.closest("[data-buy]"); if(buy){const p=prints.find(x=>x.id===Number(buy.dataset.buy));if(p){addToCart(p.id,buy.closest(".product-card"));$("cart-name").focus();}return;}
    const add=e.target.closest("[data-add]");if(add){addToCart(Number(add.dataset.add),add.closest(".product-card"));return;}
    const qty=e.target.closest("[data-qty]");if(qty){changeQty(Number(qty.dataset.id),qty.dataset.color,Number(qty.dataset.qty));}
  });
  $("custom-order-form").addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form);if(!data.get("Customer_Email"))data.set("Customer_Email","Not provided");
    if(await sendForm(data,$("custom-submit"),"Send custom request ↗")){form.reset();showStatus("Custom request sent","Your model link and print details were submitted. The site owner can follow up to confirm price and pickup.");}
  });
  $("checkout-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!cart.length){showStatus("Your cart is empty","Add at least one print before submitting an order request.");return;}
    const data=new FormData();data.append("Order_Type","Shopping Cart Order Request");data.append("Customer_Name",$("cart-name").value);data.append("Customer_Email",$("cart-email").value||"Not provided");
    data.append("Cart_Total",$("cart-total").textContent);data.append("Cart_Items_Breakdown",cart.map((i,n)=>`${n+1}. ${i.title} (${i.color}) — Qty ${i.qty} @ ${i.price}`).join("\n"));
    if(await sendForm(data,$("checkout-button"),"Submit order request ↗")){cart=[];writeStorage(STORAGE.cart,cart);renderCart();closeCart();$("checkout-form").reset();showStatus("Order request sent","Thanks! Your order request was submitted. No payment was taken; the site owner will confirm the details.");}
  });
  $("login-form").addEventListener("submit",e=>{e.preventDefault();if($("admin-password").value===ADMIN_PASSWORD){$("login-error").classList.add("hidden");unlockAdmin();}else $("login-error").classList.remove("hidden");});
  $("admin-logout").addEventListener("click",lockAdmin); $("save-colors").addEventListener("click",saveColors);
  $("reset-catalog").addEventListener("click",()=>{if(confirm("Reset all print slots and photos to the starter catalog in this browser?")){prints=defaultPrints.map(p=>({...p}));persistPrints();showStatus("Catalog reset","The starter catalog has been restored in this browser.");}});
  $("admin-slots").addEventListener("change",e=>{const el=e.target.closest("[data-field]");if(!el)return;const p=prints[Number(el.dataset.index)];if(!p)return;p[el.dataset.field]=el.type==="checkbox"?el.checked:el.value;if(el.dataset.field==="image"){persistPrints();}else{writeStorage(STORAGE.prints,prints);renderCatalog();}});
  $("admin-slots").addEventListener("input",e=>{const el=e.target.closest("input[data-field],textarea[data-field]");if(!el||el.type==="checkbox")return;const p=prints[Number(el.dataset.index)];if(!p)return;p[el.dataset.field]=el.value;writeStorage(STORAGE.prints,prints);renderCatalog();});
  function resizeImage(file,max=900){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg",0.82));
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read that image."));};
      img.src=url;
    });
  }
  $("admin-slots").addEventListener("change",async e=>{
    const input=e.target.closest("input[data-upload]"); if(!input||!input.files[0]) return;
    const p=prints[Number(input.dataset.upload)]; if(!p) return;
    const file=input.files[0];
    if(!file.type.startsWith("image/")){showStatus("Not an image","Please choose a JPG, PNG, WebP or GIF file.");input.value="";return;}
    input.disabled=true;
    try{ p.image=await uploadPhoto(file,900); persistPrints(); }
    catch(err){ showStatus("Could not use that photo",err.message); input.value=""; }
    input.disabled=false;
  });
  $("admin-slots").addEventListener("click",e=>{
    const rm=e.target.closest("[data-remove-slot]");
    if(rm){
      const p=prints[Number(rm.dataset.removeSlot)]; if(!p) return;
      if(!confirm(`Remove "${p.title||"this slot"}" from the store? This only affects this browser until you export the catalog.`)) return;
      prints=prints.filter(x=>x!==p);
      cart=cart.filter(i=>i.id!==p.id); writeStorage(STORAGE.cart,cart);
      persistPrints(); return;
    }
    const btn=e.target.closest("[data-clear-photo]"); if(!btn) return;
    const p=prints[Number(btn.dataset.clearPhoto)]; if(!p) return;
    p.image=""; persistPrints();
  });
  async function uploadPhoto(file,width){
    const dataUrl=await resizeImage(file,width);
    try{
      const body=new FormData();
      body.append("file",await (await fetch(dataUrl)).blob(),"photo.jpg");
      body.append("upload_preset",CLOUDINARY.uploadPreset);
      const res=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,{method:"POST",body});
      const json=await res.json();
      if(!res.ok||!json.secure_url) throw new Error((json.error&&json.error.message)||"Upload failed");
      return json.secure_url.replace("/upload/",`/upload/f_auto,q_auto,w_${width}/`);
    }catch(err){
      showStatus("Saved on this device only","Cloudinary upload failed ("+err.message+"), so the photo was kept in this browser only.");
      return dataUrl;
    }
  }
  // ----- Site images (home photo, logo, caption) -----
  const SITE_DEFAULTS = {hero:"", logo:"", heroLabel:"Community showcase", heroTitle:"Rockwell Christian School", ...(CFG.site||{})};
  const ORIGINALS = {hero:"assets/rockwell-christian-school.jpeg", logo:"assets/rcs-shield.png"};
  const SITE_KEY="rcsprints_site_v2";
  let site={...SITE_DEFAULTS,...readStorage(SITE_KEY,{})};
  function applySite(){
    const hero=site.hero||ORIGINALS.hero, logo=site.logo||ORIGINALS.logo;
    const heroImg=document.querySelector(".hero-image img"); if(heroImg) heroImg.src=hero;
    document.querySelectorAll(".brand-mark,.footer-brand img").forEach(i=>i.src=logo);
    const fav=document.querySelector('link[rel="icon"]'); if(fav) fav.href=logo;
    if($("site-hero-thumb")){ $("site-hero-thumb").src=hero; $("site-logo-thumb").src=logo; }
  }
  function saveSite(){ writeStorage(SITE_KEY,site); applySite(); }
  document.addEventListener("change",async e=>{
    const input=e.target.closest("input[data-site-upload]"); if(!input||!input.files[0]) return;
    const key=input.dataset.siteUpload, file=input.files[0];
    if(!file.type.startsWith("image/")){showStatus("Not an image","Please choose a JPG, PNG, WebP or GIF file.");input.value="";return;}
    input.disabled=true;
    try{ site[key]=await uploadPhoto(file,key==="logo"?300:1200); saveSite(); }
    catch(err){ showStatus("Could not use that photo",err.message); }
    input.value=""; input.disabled=false;
  });
  document.addEventListener("click",e=>{
    const btn=e.target.closest("[data-site-reset]"); if(!btn) return;
    site[btn.dataset.siteReset]=""; saveSite();
  });
  document.addEventListener("input",e=>{
  });
  applySite();
  $("add-slot").addEventListener("click",()=>{
    const id=prints.reduce((m,p)=>Math.max(m,Number(p.id)||0),0)+1;
    prints.push({id,title:"New print",price:"$0.00",image:"",desc:"Describe this print.",featured:false});
    persistPrints();
    const last=$("admin-slots").lastElementChild;
    if(last){ last.scrollIntoView({behavior:"smooth",block:"center"}); const t=last.querySelector('[data-field="title"]'); if(t){t.focus();t.select();} }
  });

  // ===== Homepage editor: colors, fonts, text, placement, sections =====
  const ROOT=document.documentElement;
  const IN_PREVIEW=window.self!==window.top;
  if(new URLSearchParams(location.search).has("preview")) ROOT.classList.add("is-preview");
  const g=(n,w,f)=>({n,s:`"${n}",${f}`,w});
  const FONT_LIST=[
    {n:"System default",s:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"},
    {n:"Georgia (classic serif)",s:"Georgia,'Times New Roman',serif"},
    {n:"Courier (typewriter)",s:"'Courier New',Courier,monospace"},
    g("Space Grotesk","400;500;600;700","sans-serif"),g("DM Sans","400;500;600;700","sans-serif"),g("Inter","400;500;600;700","sans-serif"),
    g("Poppins","400;500;600;700","sans-serif"),g("Montserrat","400;500;600;700","sans-serif"),g("Roboto","400;500;700","sans-serif"),
    g("Open Sans","400;600;700","sans-serif"),g("Lato","400;700","sans-serif"),g("Nunito","400;600;700","sans-serif"),
    g("Raleway","400;500;600;700","sans-serif"),g("Oswald","400;500;600;700","sans-serif"),g("Bebas Neue","400","sans-serif"),
    g("Archivo Black","400","sans-serif"),g("Orbitron","400;500;600;700","sans-serif"),g("Rajdhani","400;500;600;700","sans-serif"),
    g("Playfair Display","400;500;600;700","serif"),g("Merriweather","400;700","serif"),g("Lora","400;500;600;700","serif"),
    g("Roboto Slab","400;500;700","serif"),g("Pacifico","400","cursive"),g("Lobster","400","cursive"),
    g("Press Start 2P","400","monospace"),g("JetBrains Mono","400;500;700","monospace"),g("Courier Prime","400;700","monospace")
  ];
  const isListed=n=>FONT_LIST.some(f=>f.n===n);
  const cleanFont=n=>/^[A-Za-z0-9 ]{2,40}$/.test(String(n||"").trim())?String(n).trim():"";
  const stackOf=n=>{ const f=FONT_LIST.find(x=>x.n===n); if(f) return f.s; const c=cleanFont(n); return c?`"${c}",sans-serif`:""; };
  const fontLinks=new Map(), fontFail=new Set();
  const THEME_VARS=[["--bg","Page background"],["--panel","Cards & panels"],["--panel-2","Cards & panels (lighter)"],["--panel-3","Fills & hover tints"],["--green","Buttons & accents"],["--green-bright","Highlight color (titles, links)"],["--accent-soft","Small accent text"],["--text","Main text"],["--text-soft","Soft text"],["--muted","Muted text"],["--muted-2","Faint text"],["--line","Borders"],["--line-2","Strong borders"],["--cream","Light button color"]];
  const P=a=>Object.fromEntries(THEME_VARS.map(([v],i)=>[v,a[i]]));
  const PRESETS={
    "Forest (original)":{},
    "Midnight blue":P(["#0a1220","#0f1a2e","#14223a","#1a2d4d","#2563eb","#60a5fa","#93c5fd","#f1f5fb","#b8c4d6","#9aa8bd","#74839a","#243653","#3a5683","#e6edf8"]),
    "Royal purple":P(["#130d1f","#1b1330","#241a3f","#2f2252","#7c3aed","#c084fc","#d8b4fe","#f6f2fb","#cbbfdc","#aa9cc0","#8577a0","#3a2a5c","#5b4590","#eee6f8"]),
    "Sunset":P(["#1a0f0b","#251611","#311c15","#4a2a1c","#d9480f","#ff9f43","#ffc078","#fbf5f0","#d6c3b6","#b59f90","#8f786a","#4a2c20","#7a4a33","#f6e8dc"]),
    "Charcoal & red":P(["#121212","#1b1b1b","#242424","#333333","#c92a2a","#ff6b6b","#ffa8a8","#f5f5f5","#c4c4c4","#a0a0a0","#7d7d7d","#2f2f2f","#4d4d4d","#eeeeee"]),
    "Light":P(["#f4f7f4","#ffffff","#e9f0ea","#dbe8de","#1f7048","#17703f","#1f7048","#10211a","#2c3f35","#4d6055","#66786d","#cddad0","#aebfb3","#10211a"])
  };
  const SECTIONS=[["hero","Hero (top of page)"],["strip","Process strip"],["featured","Featured prints"],["cta","Call-to-action band"]];
  const pageHomeEl=$("page-home");
  const secEls=Object.fromEntries(SECTIONS.map(([k])=>[k,pageHomeEl.querySelector(`[data-section-key="${k}"]`)]));
  const THEME_DEFAULT=Object.fromEntries(THEME_VARS.map(([v])=>[v,getComputedStyle(ROOT).getPropertyValue(v).trim()]));
  const ORIG_TITLE=document.title, heroImgEl=pageHomeEl.querySelector(".hero-image img"), ORIG_ALT=heroImgEl.getAttribute("alt")||"";
  const editEls=[...document.querySelectorAll("[data-edit]")];
  const ORIG={};
  editEls.forEach(el=>{
    const found=[...el.querySelectorAll("[data-part]")], partEls=found.length?found:[el];
    ORIG[el.dataset.edit]={el,partEls,parts:partEls.map(p=>p.textContent),partLabels:partEls.map(p=>p.dataset.partLabel||"Text"),
      label:el.dataset.label||el.dataset.edit,group:el.dataset.group||"Other",controls:(el.dataset.controls||"text,font,size,color,align,hide").split(","),
      isLink:el.hasAttribute("data-link"),href:el.getAttribute("href"),page:el.dataset.page,section:el.dataset.section};
  });
  const LINK_TARGETS={home:["#home","page","home","Home page"],store:["#store","page","store","Print Store"],calculator:["#calculator","section","calculator","Calculator"],"custom-order":["#custom-order","section","custom-order","Custom Order form"]};
  const safeUrl=u=>{ u=String(u||"").trim(); return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(u)?u:(u?"https://"+u.replace(/^\/+/,""):"#"); };
  const normHex=s=>{ s=String(s).trim().replace(/^#/,""); if(/^[0-9a-f]{3}$/i.test(s)) s=s.split("").map(c=>c+c).join(""); return /^[0-9a-f]{6}$/i.test(s)?"#"+s.toLowerCase():null; };
  const hexToRgb=h=>{ h=String(h).replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0); };
  const lumOf=rgb=>{ const [r,gg,b]=rgb.map(v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*r+.7152*gg+.0722*b; };
  const ratio=(a,b)=>{ const x=lumOf(hexToRgb(a)),y=lumOf(hexToRgb(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  const rgbToHex=s=>{ const m=String(s).match(/\d+(\.\d+)?/g); return m?"#"+m.slice(0,3).map(v=>Math.round(+v).toString(16).padStart(2,"0")).join(""):"#000000"; };

  function pruneHome(){
    const clean=(o,inParts)=>{ for(const k of Object.keys(o)){ const v=o[k];
      if(v&&typeof v==="object"){ clean(v,k==="parts"); if(!Object.keys(v).length) delete o[k]; }
      else if(!inParts&&(v===""||v===null||v===undefined||v===false)) delete o[k]; } };
    clean(home,false);
  }
  function saveHome(){ pruneHome(); writeStorage(HOME_KEY,home); applyHome(); }
  const elCfg=(key,create)=>{ home.el=home.el||{}; if(!home.el[key]&&create) home.el[key]={}; return home.el[key]||{}; };

  function noteFonts(){ const el=$("he-font-note"); if(!el) return; el.hidden=!fontFail.size; el.textContent=fontFail.size?"⚠ Couldn’t load: "+[...fontFail].join(", ")+". Check the spelling (it must match fonts.google.com exactly) and your internet connection. Until it loads, a backup font is shown.":""; }
  function loadFonts(){
    const used=[...new Set([home.fonts&&home.fonts.heading,home.fonts&&home.fonts.body,...Object.values(home.el||{}).map(c=>c.font)].filter(Boolean))];
    used.forEach(n=>{
      if(fontLinks.has(n)) return; const f=FONT_LIST.find(x=>x.n===n); if(f&&!f.w) return; const c=f?f.n:cleanFont(n); if(!c) return;
      const link=document.createElement("link"); link.rel="stylesheet";
      link.href="https://fonts.googleapis.com/css2?family="+c.replace(/ /g,"+")+(f&&f.w?":wght@"+f.w:"")+"&display=swap";
      link.onerror=()=>{ fontFail.add(n); noteFonts(); }; link.onload=()=>{ fontFail.delete(n); noteFonts(); };
      document.head.appendChild(link); fontLinks.set(n,link);
    });
    for(const [n,l] of [...fontLinks]) if(!used.includes(n)){ l.remove(); fontLinks.delete(n); fontFail.delete(n); }
    noteFonts();
  }
  function applyAlign(el,a){
    const s=el.style, fig=el.tagName==="FIGCAPTION", hidden=s.display==="none";
    s.textAlign=s.marginLeft=s.marginRight=s.justifyContent=s.justifyItems=s.left=s.right=""; s.display=hidden?"none":"";
    if(!a) return;
    s.textAlign=a;
    const map={left:["flex-start","start"],center:["center","center"],right:["flex-end","end"]}[a];
    if(fig){ if(a==="center"){s.left="0";s.right="0";} else if(a==="right"){s.left="auto";s.right="27px";} s.justifyItems=map[1]; return; }
    if(!hidden){ const d=getComputedStyle(el).display; if(/^inline/.test(d)) s.display=d==="inline"?"block":d.replace("inline-",""); }
    s.justifyContent=map[0]; s.marginLeft=a==="left"?"0":"auto"; s.marginRight=a==="right"?"0":"auto";
  }
  function applyLink(el,o,link){
    if(!o.isLink) return;
    ["target","rel"].forEach(a=>el.removeAttribute(a)); delete el.dataset.page; delete el.dataset.section;
    if(link&&link.type==="url"){ el.setAttribute("href",safeUrl(link.url)); el.target="_blank"; el.rel="noopener noreferrer"; return; }
    const t=link&&LINK_TARGETS[link.type];
    if(t){ el.setAttribute("href",t[0]); el.dataset[t[1]]=t[2]; return; }
    if(o.href!==null) el.setAttribute("href",o.href);
    if(o.page) el.dataset.page=o.page;
    if(o.section) el.dataset.section=o.section;
  }
  function applyScales(){
    editEls.forEach(el=>{ el.style.fontSize=""; ORIG[el.dataset.edit].partEls.forEach(p=>{ if(p!==el) p.style.fontSize=""; }); });
    const jobs=[];
    editEls.forEach(el=>{ const sc=((home.el||{})[el.dataset.edit]||{}).scale; if(!sc||sc===100) return;
      const b=parseFloat(getComputedStyle(el).fontSize);
      jobs.push([el,b*sc/100]);
      ORIG[el.dataset.edit].partEls.forEach(p=>{ if(p===el) return; const pb=parseFloat(getComputedStyle(p).fontSize); if(Math.abs(pb-b)>.1) jobs.push([p,pb*sc/100]); });
    });
    jobs.forEach(([e,px])=>{ if(px) e.style.fontSize=px.toFixed(1)+"px"; });
  }

  // ----- Falling effects (snow, hearts, leaves...) -----
  const FALL_TYPES={
    snow:{label:"❄️ Snowflakes",chars:["❅","❆","❉","✼"],tint:true},
    hearts:{label:"💖 Hearts (Valentine's)",chars:["💖","💗","💕","❤️"]},
    flowers:{label:"🌸 Spring flowers",chars:["🌸","🌼","🌷"]},
    clover:{label:"🍀 Lucky clovers",chars:["☘️","🍀"]},
    leaves:{label:"🍂 Autumn leaves",chars:["🍂","🍁"]},
    halloween:{label:"🎃 Halloween",chars:["🎃","🦇","👻"]},
    christmas:{label:"🎄 Christmas",chars:["🎄","🎁","⭐","🔔"]},
    stars:{label:"✨ Stars & sparkles",chars:["⭐","✨","🌟"]},
    confetti:{label:"🎉 Confetti",shape:"confetti",colors:["#ff595e","#ffca3a","#8ac926","#1982c4","#6a4c93"]},
    patriotic:{label:"🇺🇸 Red, white & blue confetti",shape:"confetti",colors:["#d62839","#ffffff","#2b59c3"]},
    rain:{label:"🌧️ Rain",shape:"rain",tint:true},
    bubbles:{label:"🫧 Bubbles",shape:"bubble",tint:true},
    custom:{label:"✏️ My own emoji or characters"}
  };
  const FALL_DEFAULTS={amount:40,speed:4,size:22,drift:40,opacity:90,color:"#ffffff",where:"all"};
  const fallCfg=()=>({...FALL_DEFAULTS,...(home.fall||{})});
  let fallCanvas=null,fallRaf=0,fallParts=[],fallKey="",fallLast=0,fallT=0,fallChars=[];
  const reduceMotion=()=>!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  const segs=s=>{ try{ return [...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(String(s||""))].map(x=>x.segment).filter(x=>x.trim()); }catch{ return Array.from(String(s||"")).filter(x=>x.trim()); } };
  function inSeason(c,force){
    if((!force&&ROOT.classList.contains("is-preview"))||!c.from||!c.to) return true;
    const md=s=>{ const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(s); return m?(+m[1])*100+(+m[2]):null; };
    const f=md(c.from),t=md(c.to); if(f===null||t===null) return true;
    const n=new Date(),cur=(n.getMonth()+1)*100+n.getDate();
    return f<=t?(cur>=f&&cur<=t):(cur>=f||cur<=t);
  }
  function fallAllowed(c){
    const pg=((document.querySelector(".page.active")||{}).dataset||{}).pagePanel;
    if(pg==="admin"&&!IN_PREVIEW) return false;
    return c.where==="home"?pg==="home":true;
  }
  function newParticle(c,W,H,initial){
    const T=FALL_TYPES[c.type], s=c.size*(0.6+Math.random()*0.8), rain=T.shape==="rain";
    return {x:Math.random()*W,y:initial?Math.random()*H:-s-Math.random()*H*0.25,s:rain?c.size*(0.8+Math.random()*0.8):s,
      vy:(0.35+Math.random()*0.65)*c.speed*(rain?70:22),ph:Math.random()*6.28,sp:0.6+Math.random()*1.2,rot:Math.random()*6.28,
      vr:(Math.random()-.5)*(T.chars&&!T.tint?0.9:1.8),
      ch:fallChars.length?fallChars[Math.floor(Math.random()*fallChars.length)]:"",
      col:T.colors?T.colors[Math.floor(Math.random()*T.colors.length)]:c.color};
  }
  function sizeFall(){
    if(!fallCanvas) return; const dpr=Math.min(2,window.devicePixelRatio||1);
    fallCanvas.width=Math.round(innerWidth*dpr); fallCanvas.height=Math.round(innerHeight*dpr);
    fallCanvas.getContext("2d").setTransform(dpr,0,0,dpr,0,0);
  }
  function fallLoop(now){
    fallRaf=requestAnimationFrame(fallLoop); if(!fallCanvas) return;
    const c=fallCfg(), T=FALL_TYPES[c.type]; if(!T) return;
    const dt=Math.min(.05,((now-fallLast)/1000)||.016); fallLast=now;
    const allowed=fallAllowed(c); fallCanvas.style.display=allowed?"":"none"; if(!allowed) return;
    const ctx=fallCanvas.getContext("2d"),W=innerWidth,H=innerHeight; ctx.clearRect(0,0,W,H); ctx.globalAlpha=Math.min(1,Math.max(.1,c.opacity/100)); fallT+=dt;
    const rain=T.shape==="rain";
    for(const p of fallParts){
      p.y+=p.vy*dt; p.x+=(rain?c.drift*0.15:Math.sin(fallT*p.sp+p.ph)*c.drift*0.6)*dt+(rain?c.drift*0.4*dt:0); p.rot+=p.vr*dt;
      if(p.y>H+p.s+10||p.x>W+60||p.x<-60){ Object.assign(p,newParticle(c,W,H,false)); }
      ctx.save(); ctx.translate(p.x,p.y);
      if(T.shape==="confetti"){ ctx.rotate(p.rot); ctx.fillStyle=p.col; ctx.scale(1,Math.cos(fallT*p.sp*2+p.ph)); ctx.fillRect(-p.s*.2,-p.s*.35,p.s*.4,p.s*.7); }
      else if(rain){ ctx.strokeStyle=p.col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-p.s*.12,p.s); ctx.stroke(); }
      else if(T.shape==="bubble"){ ctx.strokeStyle=p.col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,p.s*.45,0,6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(-p.s*.15,-p.s*.15,p.s*.1,0,6.283); ctx.fillStyle=p.col; ctx.fill(); }
      else{ ctx.rotate(T.tint?p.rot:Math.sin(p.rot)*.5); ctx.font=p.s+'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle=p.col; ctx.fillText(p.ch,0,0); }
      ctx.restore();
    }
  }
  function stopFall(){ cancelAnimationFrame(fallRaf); fallRaf=0; if(fallCanvas){ fallCanvas.remove(); fallCanvas=null; } fallParts=[]; }
  function applyFall(){
    const c=fallCfg(), T=FALL_TYPES[c.type];
    const chars=!T?[]:(c.type==="custom"?segs(c.custom):(T.chars||[]));
    const on=!!T&&(!reduceMotion()||c.ignoreReduce||IN_PREVIEW)&&inSeason(c)&&(T.shape||chars.length);
    const key=on?JSON.stringify(c):""; if(key===fallKey) return; fallKey=key;
    if(!on){ stopFall(); return; }
    fallChars=chars;
    if(!fallCanvas){ fallCanvas=document.createElement("canvas"); fallCanvas.id="fall-canvas"; fallCanvas.setAttribute("aria-hidden","true"); document.body.appendChild(fallCanvas); }
    sizeFall();
    const n=Math.round(Math.min(150,c.amount)*Math.min(1,innerWidth/900+.35));
    fallParts=Array.from({length:n},()=>newParticle(c,innerWidth,innerHeight,true));
    if(!fallRaf){ fallLast=performance.now(); fallRaf=requestAnimationFrame(fallLoop); }
  }
  window.addEventListener("resize",()=>{ if(fallCanvas) sizeFall(); });
  function fallStatus(){
    const c=fallCfg(), T=FALL_TYPES[c.type];
    if(!T) return "Choose an effect above to turn it on.";
    if(c.type==="custom"&&!segs(c.custom).length) return "⚠ Type at least one emoji or character.";
    if(reduceMotion()&&!c.ignoreReduce) return "⚠ This device has “Reduce motion” turned on, so you won’t see the effect on the real site here (the preview on the right still shows it). Visitors with that setting won’t see it either. To test on this screen, turn that setting off in your system’s accessibility settings.";
    if(!inSeason(c,true)) return "⚠ Today is outside your start and end dates, so visitors won’t see it yet. (The preview ignores dates.)";
    return "✓ Visitors will see it now"+(c.where==="home"?" on the home page.":" on every page except Admin.");
  }
  function applyHome(){
    const th=home.theme||{};
    THEME_VARS.forEach(([v])=>th[v]?ROOT.style.setProperty(v,th[v]):ROOT.style.removeProperty(v));
    const fo=home.fonts||{};
    fo.heading?ROOT.style.setProperty("--font-heading",stackOf(fo.heading)):ROOT.style.removeProperty("--font-heading");
    fo.body?ROOT.style.setProperty("--font-body",stackOf(fo.body)):ROOT.style.removeProperty("--font-body");
    home.radius!==undefined&&home.radius!==""?ROOT.style.setProperty("--radius",home.radius+"px"):ROOT.style.removeProperty("--radius");
    document.title=home.title||ORIG_TITLE;
    const hero=secEls.hero; hero.classList.remove("layout-left","layout-stack","layout-none");
    if(home.layout&&home.layout!=="right") hero.classList.add("layout-"+home.layout);
    const hi=hero.querySelector(".hero-image"); hi.style.height=home.heroHeight?home.heroHeight+"px":""; hi.style.maxHeight=home.heroHeight?"110vw":"";
    heroImgEl.alt=home.heroAlt||ORIG_ALT;
    const sec=home.sections||{}, order=(sec.order||[]).filter(k=>secEls[k]); SECTIONS.forEach(([k])=>{ if(!order.includes(k)) order.push(k); });
    order.forEach(k=>pageHomeEl.appendChild(secEls[k]));
    SECTIONS.forEach(([k])=>{ secEls[k].style.display=(sec.hidden&&sec.hidden[k])?"none":""; });
    editEls.forEach(el=>{
      const key=el.dataset.edit,o=ORIG[key],c=(home.el&&home.el[key])||{};
      o.partEls.forEach((p,i)=>{ const t=c.parts&&c.parts[i]; p.textContent=(t!==undefined&&t!==null)?t:o.parts[i]; });
      const fam=c.font?stackOf(c.font):"";
      [el,...o.partEls].forEach(n=>{ n.style.fontFamily=fam; n.style.color=c.color||""; n.style.fontWeight=c.weight||""; n.style.letterSpacing=(c.spacing===undefined||c.spacing==="")?"":(c.spacing/100)+"em"; });
      el.style.display=c.hidden?"none":"";
      applyAlign(el,c.align||"");
      applyLink(el,o,c.link);
    });
    loadFonts(); applyScales(); renderCatalog(); applyFall();
  }
  let rsT; window.addEventListener("resize",()=>{ clearTimeout(rsT); rsT=setTimeout(applyScales,120); });
  window.addEventListener("storage",e=>{
    if(!IN_PREVIEW) return;
    if(e.key===HOME_KEY){ home=deepMerge(HOME_DEFAULTS,readStorage(HOME_KEY,{})); applyHome(); }
    else if(e.key===SITE_KEY){ site={...SITE_DEFAULTS,...readStorage(SITE_KEY,{})}; applySite(); }
    else if(e.key===STORAGE.prints){ prints=readStorage(STORAGE.prints,defaultPrints); renderCatalog(); }
  });

  // ----- editor panel (admin) -----
  function contrastNote(){
    const T=v=>(home.theme&&home.theme[v])||THEME_DEFAULT[v];
    const pairs=[["Main text on background","--text","--bg"],["Muted text on background","--muted","--bg"],["Highlight on background","--green-bright","--bg"],["Text on cards","--text","--panel"]];
    $("he-contrast").innerHTML="<strong>Readability check</strong><br>"+pairs.map(([l,a,b])=>{ const r=ratio(T(a),T(b)); return `<span class="${r>=4.5?"ok":"bad"}">${r>=4.5?"✓":"⚠"} ${l}: ${r.toFixed(1)}:1</span>`; }).join("<br>")+"<br>Aim for 4.5:1 or higher so text is easy to read.";
  }
  function fontPicker(h,cur,dflt,label,key){
    const e=escapeHTML, custom=cur&&!isListed(cur), k=key?` data-k="${key}"`:"";
    return `<label>${label}<select data-h="${h}"${k}><option value="">${dflt}</option>${custom?`<option value="__custom" selected>Custom: ${e(cur)}</option>`:""}${FONT_LIST.map(f=>`<option${cur===f.n?" selected":""}>${e(f.n)}</option>`).join("")}</select></label>`+
      `<label>Or type any Google Font name<input type="text" data-h="${h}-custom"${k} placeholder="for example: Caveat" value="${custom?e(cur):""}"></label>`+
      `<div class="he-sample" style="font-family:${e(stackOf(cur)||"inherit")}">The quick brown fox 0123</div>`;
  }
  function elCard(key){
    const o=ORIG[key],c=(home.el&&home.el[key])||{},ctl=o.controls,e=escapeHTML;
    let b="";
    if(ctl.includes("text")) b+=o.partEls.map((_,i)=>{ const v=(c.parts&&c.parts[i]!==undefined)?c.parts[i]:o.parts[i]; const lab=o.partEls.length>1?o.partLabels[i]:"Text";
      return `<label>${e(lab)}`+(o.parts[i].length>70?`<textarea rows="3" data-h="part" data-k="${key}" data-i="${i}">${e(v)}</textarea>`:`<input type="text" data-h="part" data-k="${key}" data-i="${i}" value="${e(v)}">`)+`</label>`; }).join("");
    if(ctl.includes("font")){ b+=fontPicker("el-font",c.font,"Default","Font",key)+`<label>Weight<select data-h="el-weight" data-k="${key}">${[["","Default"],["400","Regular"],["500","Medium"],["700","Bold"]].map(([v,l])=>`<option value="${v}"${String(c.weight||"")===v?" selected":""}>${l}</option>`).join("")}</select></label><label>Letter spacing: <output>${(c.spacing===undefined||c.spacing==="")?"Original":c.spacing/100+"em"}</output><input type="range" min="-10" max="30" step="1" value="${c.spacing||0}" data-h="el-spacing" data-k="${key}"></label><button type="button" class="he-mini" data-h="el-spacing-reset" data-k="${key}">Original spacing</button>`; }
    if(ctl.includes("size")) b+=`<label>Size: <output>${c.scale||100}%</output><input type="range" min="50" max="250" step="5" value="${c.scale||100}" data-h="el-scale" data-k="${key}"></label>`;
    if(ctl.includes("color")){ const cur=c.color||rgbToHex(getComputedStyle(o.el).color); b+=`<div class="he-row"><label>Text color<input type="color" data-h="el-color" data-k="${key}" value="${cur}"></label><input type="text" class="hex" data-h="el-color-hex" data-k="${key}" value="${cur}" maxlength="7" spellcheck="false" aria-label="Text color code"><button type="button" class="he-mini" data-h="el-color-reset" data-k="${key}"${c.color?"":" disabled"}>Default</button></div>`; }
    if(ctl.includes("align")) b+=`<div><div class="he-note">Text placement</div><div class="he-align">${[["","Default"],["left","Left"],["center","Center"],["right","Right"]].map(([v,l])=>`<button type="button" data-h="el-align" data-k="${key}" data-v="${v}" class="${(c.align||"")===v?"on":""}">${l}</button>`).join("")}</div></div>`;
    if(o.isLink&&ctl.includes("link")){ const t=(c.link&&c.link.type)||""; b+=`<label>Button goes to<select data-h="el-link" data-k="${key}"><option value="">Original destination</option>${Object.entries(LINK_TARGETS).map(([k,v])=>`<option value="${k}"${t===k?" selected":""}>${v[3]}</option>`).join("")}<option value="url"${t==="url"?" selected":""}>Another website…</option></select></label>`+(t==="url"?`<label>Web address<input type="text" data-h="el-url" data-k="${key}" placeholder="https://example.com" value="${e((c.link&&c.link.url)||"")}"></label>`:""); }
    if(ctl.includes("hide")) b+=`<label class="check-label"><input type="checkbox" data-h="el-hide" data-k="${key}"${c.hidden?" checked":""}> Hide this</label>`;
    b+=`<button type="button" class="he-mini" data-h="el-reset" data-k="${key}">Reset this item</button>`;
    return `<details class="he-el" data-id="el-${key}"><summary>${e(o.label)}</summary><div class="he-body">${b}</div></details>`;
  }
  function fallEditor(){
    const c=fallCfg(), e=escapeHTML;
    const rng=(f,label,min,max,step,unit)=>`<label>${label}: <output>${c[f]}${unit}</output><input type="range" min="${min}" max="${max}" step="${step}" value="${c[f]}" data-h="fall" data-f="${f}"></label>`;
    let b=`<label>Effect<select data-h="fall" data-f="type"><option value="">None</option>${Object.entries(FALL_TYPES).map(([k,v])=>`<option value="${k}"${c.type===k?" selected":""}>${v.label}</option>`).join("")}</select></label>`;
    if(c.type){
      if(c.type==="custom") b+=`<label>Your emoji or characters<input type="text" data-h="fall" data-f="custom" value="${e(c.custom||"")}" placeholder="for example: 🦃🍂 or ❤"></label>`;
      b+=rng("amount","How many",5,150,5,"")+rng("speed","Fall speed",1,10,1,"")+rng("size","Size",10,60,1,"px")+rng("drift","Side-to-side drift",0,100,5,"")+rng("opacity","Strength (see-through)",20,100,5,"%");
      if(FALL_TYPES[c.type].tint) b+=`<div class="he-row"><label>Color<input type="color" data-h="fall-color" value="${c.color}"></label><input type="text" class="hex" data-h="fall-hex" value="${c.color}" maxlength="7" spellcheck="false" aria-label="Falling effect color code"></div>`;
      b+=`<label class="check-label"><input type="checkbox" data-h="fall" data-f="ignoreReduce"${c.ignoreReduce?" checked":""}> Show even to people whose device has “Reduce motion” on (not recommended)</label>`+
        `<label>Where it shows<select data-h="fall" data-f="where"><option value="all"${c.where==="all"?" selected":""}>Every page of the website</option><option value="home"${c.where==="home"?" selected":""}>Home page only</option></select></label>`+
        `<div class="he-note">Optional: turn on automatically each year (the year is ignored). Leave empty to show all the time.</div>`+
        `<label>Start date<input type="date" data-h="fall" data-f="from" value="${e(c.from||"")}"></label><label>End date<input type="date" data-h="fall" data-f="to" value="${e(c.to||"")}"></label><button type="button" class="he-mini" data-h="fall-clear-dates">Clear dates</button>`+
        `<div class="he-note">Dates are ignored in the preview so you can always see the effect. It never covers buttons or blocks clicks, and visitors who set their device to "reduce motion" won't see it.</div>`;
    }
    return `<details data-id="fall"><summary>❄️ Falling effects (seasonal)</summary><div class="he-body">${b}<div class="he-note" id="fall-status" role="status">${fallStatus()}</div><button type="button" class="he-mini" data-h="see-home">See it on the home page</button></div></details>`;
  }
  function renderHomeEditor(){
    const box=$("home-editor"); if(!box) return;
    const open=new Set([...box.querySelectorAll("details[open]")].map(d=>d.dataset.id)), e=escapeHTML;
    const T=v=>(home.theme&&home.theme[v])||THEME_DEFAULT[v], th=home.theme||{}, fo=home.fonts||{}, sec=home.sections||{};
    const order=(sec.order||[]).filter(k=>secEls[k]); SECTIONS.forEach(([k])=>{ if(!order.includes(k)) order.push(k); });
    let h=`<details data-id="colors"><summary>🎨 Colors</summary><div class="he-body"><div class="he-presets">${Object.keys(PRESETS).map(n=>`<button type="button" class="button button-outline" data-h="preset" data-v="${e(n)}">${e(n)}</button>`).join("")}</div>`+
      THEME_VARS.map(([v,l])=>`<div class="he-row"><label>${l}<input type="color" data-h="theme" data-v="${v}" value="${T(v)}"></label><input type="text" class="hex" data-h="theme-hex" data-v="${v}" value="${T(v)}" maxlength="7" spellcheck="false" aria-label="${l} color code"><button type="button" class="he-mini" data-h="theme-reset" data-v="${v}"${th[v]?"":" disabled"}>Reset</button></div>`).join("")+`<div class="he-note" id="he-contrast"></div></div></details>`;
    h+=`<details data-id="fonts"><summary>🔤 Fonts & shape</summary><div class="he-body">${fontPicker("font-heading",fo.heading,"Original (Space Grotesk)","Headings font")}${fontPicker("font-body",fo.body,"Original (DM Sans)","Body font")}`+
      `<label>Corner roundness: <output>${home.radius!==undefined?home.radius:18}px</output><input type="range" min="0" max="32" step="1" value="${home.radius!==undefined?home.radius:18}" data-h="radius"></label>`+
      `<label>Browser tab title<input type="text" data-h="title" value="${e(home.title||ORIG_TITLE)}"></label></div></details>`;
    h+=`<details data-id="layout"><summary>📐 Layout & sections</summary><div class="he-body"><label>Hero photo position<select data-h="layout">${[["right","Photo on the right (original)"],["left","Photo on the left"],["stack","Photo below the text"],["none","No photo"]].map(([v,l])=>`<option value="${v}"${(home.layout||"right")===v?" selected":""}>${l}</option>`).join("")}</select></label>`+
      `<label>Hero photo height: <output>${home.heroHeight?home.heroHeight+"px":"Automatic"}</output><input type="range" min="200" max="700" step="10" value="${home.heroHeight||430}" data-h="heroHeight"></label><button type="button" class="he-mini" data-h="heroHeight-reset">Automatic height</button>`+
      `<label>Photo description (for screen readers)<input type="text" data-h="heroAlt" value="${e(home.heroAlt||ORIG_ALT)}"></label>`+
      `<label>Featured prints shown<select data-h="featuredCount">${[1,2,3,4,5,6].map(n=>`<option${(home.featuredCount||3)===n?" selected":""}>${n}</option>`).join("")}</select></label>`+
      `<div class="he-note">Sections on the home page, top to bottom:</div>`+order.map((k,i)=>`<div class="he-sec"><span>${e(SECTIONS.find(s=>s[0]===k)[1])}</span><button type="button" class="he-mini" data-h="sec-up" data-k="${k}"${i===0?" disabled":""} aria-label="Move up">↑</button><button type="button" class="he-mini" data-h="sec-down" data-k="${k}"${i===order.length-1?" disabled":""} aria-label="Move down">↓</button><label class="check-label"><input type="checkbox" data-h="sec-show" data-k="${k}"${sec.hidden&&sec.hidden[k]?"":" checked"}> Show</label></div>`).join("")+`</div></details>`;
    h+=fallEditor();
    const groups=[]; editEls.forEach(el=>{ const o=ORIG[el.dataset.edit]; let gr=groups.find(x=>x[0]===o.group); if(!gr){gr=[o.group,[]];groups.push(gr);} gr[1].push(el.dataset.edit); });
    h+=`<details data-id="text"><summary>✏️ Text, fonts & placement</summary><div class="he-body">`+groups.map(([n,keys])=>`<p class="he-group">${e(n)}</p>`+keys.map(elCard).join("")).join("")+`</div></details>`;
    h+=`<div class="he-tools"><button type="button" class="button button-outline" data-h="revert">Undo unpublished changes</button><button type="button" class="button button-outline" data-h="reset-all">Reset to original design</button></div>`;
    box.innerHTML=h; box.querySelectorAll("details").forEach(d=>{ if(open.has(d.dataset.id)) d.open=true; }); contrastNote();
  }
  function setupPreview(){
    if(IN_PREVIEW) return; const f=$("home-preview"); if(f&&!f.getAttribute("src")) f.src=location.href.split("#")[0].split("?")[0]+"?preview=1#home";
  }
  if($("home-editor")&&!IN_PREVIEW){
    const hb=$("home-editor");
    hb.addEventListener("input",e=>{
      const t=e.target,a=t.dataset.h; if(!a) return; const k=t.dataset.k;
      if(a==="fall"){ home.fall=home.fall||{}; const f=t.dataset.f; home.fall[f]=t.type==="range"?Number(t.value):(t.type==="checkbox"?t.checked:t.value);
        if(t.type==="range") t.previousElementSibling.textContent=t.value+({size:"px",opacity:"%"}[f]||""); saveHome(); if(f==="type") renderHomeEditor(); else { const st=$("fall-status"); if(st) st.textContent=fallStatus(); } return; }
      if(a==="fall-color"||a==="fall-hex"){ const val=a==="fall-color"?t.value:normHex(t.value); const hx=hb.querySelector('[data-h="fall-hex"]'), pk=hb.querySelector('[data-h="fall-color"]');
        if(!val){ t.setAttribute("aria-invalid","true"); return; } if(hx){ hx.removeAttribute("aria-invalid"); if(a==="fall-color") hx.value=val; } if(pk&&a==="fall-hex") pk.value=val; home.fall=home.fall||{}; home.fall.color=val; saveHome(); return; }
      if(a==="theme"||a==="theme-hex"){ const val=a==="theme"?t.value:normHex(t.value); const hx=hb.querySelector(`[data-h="theme-hex"][data-v="${t.dataset.v}"]`), pk=hb.querySelector(`[data-h="theme"][data-v="${t.dataset.v}"]`);
        if(!val){ t.setAttribute("aria-invalid","true"); return; } if(hx){ hx.removeAttribute("aria-invalid"); if(a==="theme") hx.value=val; } if(pk&&a==="theme-hex") pk.value=val;
        home.theme=home.theme||{}; home.theme[t.dataset.v]=val; saveHome(); contrastNote(); const b=hb.querySelector(`[data-h="theme-reset"][data-v="${t.dataset.v}"]`); if(b) b.disabled=false; return; }
      if(a==="part"){ const c=elCfg(k,true); c.parts=c.parts||{}; if(t.value===ORIG[k].parts[t.dataset.i]) delete c.parts[t.dataset.i]; else c.parts[t.dataset.i]=t.value; }
      else if(a==="el-font"){ if(t.value==="__custom") return; elCfg(k,true).font=t.value; saveHome(); renderHomeEditor(); return; }
      else if(a==="el-weight") elCfg(k,true).weight=t.value;
      else if(a==="el-spacing"){ elCfg(k,true).spacing=Number(t.value); t.previousElementSibling.textContent=(Number(t.value)/100)+"em"; }
      else if(a==="el-scale"){ elCfg(k,true).scale=t.value==="100"?"":Number(t.value); t.previousElementSibling.textContent=t.value+"%"; }
      else if(a==="el-color"||a==="el-color-hex"){ const val=a==="el-color"?t.value:normHex(t.value); const hx=hb.querySelector(`[data-h="el-color-hex"][data-k="${k}"]`), pk=hb.querySelector(`[data-h="el-color"][data-k="${k}"]`);
        if(!val){ t.setAttribute("aria-invalid","true"); return; } if(hx){ hx.removeAttribute("aria-invalid"); if(a==="el-color") hx.value=val; } if(pk&&a==="el-color-hex") pk.value=val; elCfg(k,true).color=val; const b=hb.querySelector(`[data-h="el-color-reset"][data-k="${k}"]`); if(b) b.disabled=false; }
      else if(a==="el-hide") elCfg(k,true).hidden=t.checked;
      else if(a==="el-link"){ const c=elCfg(k,true); c.link=t.value?{type:t.value,url:(c.link&&c.link.url)||""}:{}; saveHome(); renderHomeEditor(); return; }
      else if(a==="el-url"){ const c=elCfg(k,true); c.link=c.link||{type:"url"}; c.link.url=t.value; }
      else if(a==="font-heading"){ if(t.value==="__custom") return; home.fonts=home.fonts||{}; home.fonts.heading=t.value; saveHome(); renderHomeEditor(); return; }
      else if(a==="font-body"){ if(t.value==="__custom") return; home.fonts=home.fonts||{}; home.fonts.body=t.value; saveHome(); renderHomeEditor(); return; }
      else if(a==="radius"){ home.radius=Number(t.value); t.previousElementSibling.textContent=t.value+"px"; }
      else if(a==="title") home.title=t.value===ORIG_TITLE?"":t.value;
      else if(a==="layout") home.layout=t.value==="right"?"":t.value;
      else if(a==="heroHeight"){ home.heroHeight=Number(t.value); t.previousElementSibling.textContent=t.value+"px"; }
      else if(a==="heroAlt") home.heroAlt=t.value===ORIG_ALT?"":t.value;
      else if(a==="featuredCount") home.featuredCount=Number(t.value)===3?"":Number(t.value);
      else if(a==="sec-show"){ home.sections=home.sections||{}; home.sections.hidden=home.sections.hidden||{}; home.sections.hidden[k]=!t.checked; }
      else return;
      saveHome();
    });
    hb.addEventListener("click",e=>{
      const t=e.target.closest("[data-h]"); if(!t||["INPUT","SELECT","TEXTAREA"].includes(t.tagName)) return; const a=t.dataset.h,k=t.dataset.k;
      if(a==="preset"){ home.theme={...PRESETS[t.dataset.v]}; }
      else if(a==="theme-reset"){ if(home.theme) delete home.theme[t.dataset.v]; }
      else if(a==="el-color-reset"){ delete elCfg(k).color; }
      else if(a==="el-align"){ elCfg(k,true).align=t.dataset.v; }
      else if(a==="see-home"){ const l=document.querySelector('[data-edit="nav-home"]'); if(l) l.click(); return; }
      else if(a==="fall-clear-dates"){ if(home.fall){ delete home.fall.from; delete home.fall.to; } }
      else if(a==="el-spacing-reset"){ delete elCfg(k).spacing; }
      else if(a==="el-reset"){ if(home.el) delete home.el[k]; }
      else if(a==="heroHeight-reset"){ home.heroHeight=""; }
      else if(a==="sec-up"||a==="sec-down"){
        const sec=(home.sections=home.sections||{}); const order=(sec.order||[]).filter(x=>secEls[x]); SECTIONS.forEach(([x])=>{ if(!order.includes(x)) order.push(x); });
        const i=order.indexOf(k), j=a==="sec-up"?i-1:i+1; if(j<0||j>=order.length) return; [order[i],order[j]]=[order[j],order[i]]; sec.order=order;
      }
      else if(a==="reset-all"){ if(!confirm("Reset the whole home page design (colors, fonts, text, layout) to the original in this browser?")) return; home={}; }
      else if(a==="revert"){ home=deepMerge(HOME_DEFAULTS,{}); }
      else return;
      saveHome(); renderHomeEditor();
    });
    hb.addEventListener("change",e=>{
      const t=e.target,a=t.dataset.h||"",k=t.dataset.k;
      if(a.endsWith("-hex")){ const n=normHex(t.value); if(n){ t.value=n; t.removeAttribute("aria-invalid"); } else { const cur=a==="fall-hex"?fallCfg().color:a==="theme-hex"?((home.theme&&home.theme[t.dataset.v])||THEME_DEFAULT[t.dataset.v]):(((home.el||{})[k]||{}).color||rgbToHex(getComputedStyle(ORIG[k].el).color)); t.value=cur; t.removeAttribute("aria-invalid"); } return; }
      if(!a.endsWith("-custom")) return;
      const raw=t.value.trim(), n=cleanFont(raw);
      if(raw&&!n){ showStatus("Font name not valid","Use only letters, numbers and spaces, exactly as it appears on fonts.google.com, like Caveat or Open Sans."); t.value=""; return; }
      if(a==="font-heading-custom"||a==="font-body-custom"){ home.fonts=home.fonts||{}; home.fonts[a==="font-heading-custom"?"heading":"body"]=n; }
      else if(a==="el-font-custom") elCfg(k,true).font=n;
      saveHome(); renderHomeEditor();
    });
    $("home-device").addEventListener("click",e=>{ const b=e.target.closest("[data-w]"); if(!b) return; $("home-preview").style.width=b.dataset.w; $("home-device").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); });
  }
  function buildConfig(){
    pruneHome();
    let skipped=0; const clean=v=>{ if(String(v||"").startsWith("data:")){ skipped++; return ""; } return v||""; };
    const cfg={home,site:{hero:clean(site.hero),logo:clean(site.logo)},colors,prints:prints.map(p=>({...p,image:clean(p.image)}))};
    const text='// RCSprints published settings.\n// To update: in Admin click "Copy settings for GitHub", open this file on GitHub,\n// select everything, paste over it, and commit.\nwindow.RCS_CONFIG = '+JSON.stringify(cfg,null,2)+';\n';
    return {cfg,text,skipped};
  }
  $("export-all").addEventListener("click",()=>{
    const {text:out,skipped}=buildConfig();
    const box=$("export-box"); box.value=out; box.classList.remove("hidden");
    let copied=false; try{ navigator.clipboard.writeText(out).then(()=>{},()=>{}); copied=true; }catch{}
    box.select();
    showStatus("Settings copied",(copied?"Copied. ":"Select the text in the box and copy it. ")+"Now open config.js on GitHub, click the pencil icon, select everything, paste, and commit."+(skipped?" Note: "+skipped+" photo(s) were saved on this device only and left blank. Re-upload them to get a permanent link.":""));
  });
  $("verify-publish").addEventListener("click",async()=>{
    const out=$("verify-result"), e=escapeHTML, canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort()):v);
    out.innerHTML="Checking…";
    const lines=[], bad=(m)=>lines.push('<span class="bad">⚠ '+m+'</span>'), ok=(m)=>lines.push('<span class="ok">✓ '+m+'</span>');
    const url=new URL("config.js",location.href.split("#")[0].split("?")[0]);
    if(location.protocol==="file:"){ out.innerHTML='<span class="bad">⚠ This check only works on the live website (https://…), not a file opened from your computer.</span>'; return; }
    if(typeof window.RCS_CONFIG==="undefined") bad("This page did not load config.js. Make sure config.js is in the same folder as index.html on GitHub, and that index.html is the newest version.");
    let live=null;
    try{
      const res=await fetch(url.href+"?check="+Date.now(),{cache:"no-store"});
      if(!res.ok) bad("config.js was not found on your site (error "+res.status+"). It must be named exactly config.js and sit next to index.html.");
      else{ const m=(await res.text()).match(/window\.RCS_CONFIG\s*=\s*([\s\S]*?);\s*$/); try{ live=JSON.parse(m[1]); }catch{ bad("config.js on GitHub has a typo or was only partly pasted. Re-copy the settings and paste over everything in that file."); } }
    }catch(err){ bad("Could not reach "+e(url.href)+"."); }
    if(live){
      const {cfg,skipped}=buildConfig();
      [["home","Home page design (colors, fonts, text, layout)"],["site","Home photo and logo"],["colors","Materials and colors list"],["prints","Prints, prices and photos"]].forEach(([k,l])=>{ canon(live[k])===canon(cfg[k])?ok(l+" match what you see in Admin."):bad(l+" on GitHub are different from what you see in Admin. Copy settings again and paste into config.js."); });
      if(skipped) bad(skipped+" photo(s) exist only in this browser and cannot be published. Re-upload them (the upload must succeed so they get a Cloudinary link).");
      if(lines.every(l=>l.includes('class="ok"'))) lines.push("Everything published matches. If a visitor still sees the old site, GitHub Pages can take a few minutes to update. Try a private window or hold Ctrl+Shift+R.");
    }
    out.innerHTML=lines.join("<br>");
  });
  $("year").textContent=new Date().getFullYear();
  applyHome(); calculate();
  // Support direct links such as #store and #admin on GitHub Pages.
  function routeFromHash(){
    const hash=location.hash.slice(1);
    if(["home","store","admin"].includes(hash))setPage(hash);
    else if(["calculator","custom-order"].includes(hash))setPage("store",hash);
    else setPage("home");
  }
  window.addEventListener("hashchange",routeFromHash); // back/forward buttons and typed #links
  if(location.hash) routeFromHash();
})();