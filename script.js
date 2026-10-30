/* RCSprints — catalog, cart, calculator, forms, and local admin tools */
(() => {
  "use strict";
  const FORM_ENDPOINT = "https://formspree.io/f/xzeerwej";
  const CLOUDINARY = {cloudName:"dzp0rzb7", uploadPreset:"rcsprints"};
  const ADMIN_PASSWORD = "RCS26prints"; // Static-site password only; not secure authentication.
  const STORAGE = {prints:"rcsprints_prints_v2", colors:"rcsprints_colors_v2", cart:"rcsprints_cart_v2"};
  const defaultPrints = [
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
  const defaultColors = "PLA - Matte Black, PLA - Forest Green, PLA - Silk Gold, PLA - White, PETG - Cool Grey, TPU - Flexible Orange";
  const $ = id => document.getElementById(id);
  const safeParse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readStorage = (key, fallback) => { try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { showStatus("Could not save changes","Browser storage is full or unavailable. Try a smaller image or clear site data."); return false; } };
  let prints = readStorage(STORAGE.prints, defaultPrints);
  let colors = (() => { try { return localStorage.getItem(STORAGE.colors) || defaultColors; } catch { return defaultColors; } })();
  let cart = readStorage(STORAGE.cart, []);
  let adminUnlocked = false;

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
    history.replaceState(null,"",section ? "#"+section : "#"+page);
  }
  function renderColors(){
    const select=$("custom-color");
    if(select) select.innerHTML = colorList().map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("") || '<option value="Not specified">Not specified</option>';
  }
  function productCard(p, index, featured=false){
    const colorOptions=colorList().map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
    return `<article class="product-card">
      <div class="product-image"><img loading="lazy" src="${escapeHTML(imageFor(p))}" alt="${escapeHTML(p.title)}"><span class="product-tag">${featured?"Featured":"Print slot "+p.id}</span></div>
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
    $("featured-grid").innerHTML=prints.filter(p=>p.featured).slice(0,3).map(p=>productCard(p,prints.indexOf(p),true)).join("");
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
    $("cart-drawer").classList.add("open"); $("cart-drawer").setAttribute("aria-hidden","false");
    $("cart-overlay").classList.remove("hidden"); requestAnimationFrame(()=>$("cart-overlay").classList.add("visible"));
    $("close-cart").focus();
  }
  function closeCart(){
    $("cart-drawer").classList.remove("open"); $("cart-drawer").setAttribute("aria-hidden","true");
    $("cart-overlay").classList.remove("visible"); setTimeout(()=>$("cart-overlay").classList.add("hidden"),250);
    $("open-cart").focus();
  }
  function addToCart(id){
    const p=prints.find(item=>item.id===id); if(!p) return;
    const select=document.querySelector(`[data-color-for="${id}"]`);
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
    $("colors-input").value=colors; renderAdminSlots();
  }
  function lockAdmin(){ adminUnlocked=false; $("admin-login").classList.remove("hidden"); $("admin-dashboard").classList.add("hidden"); $("admin-password").value=""; }
  function renderAdminSlots(){
    if(!adminUnlocked) return;
    $("admin-slots").innerHTML=prints.map((p,i)=>`<article class="admin-slot" data-slot="${p.id}">
      <div class="admin-slot-head"><strong>Slot #${p.id}</strong><label class="check-label"><input type="checkbox" data-field="featured" data-index="${i}" ${p.featured?"checked":""}> Featured</label></div>
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
    const buy=e.target.closest("[data-buy]"); if(buy){const p=prints.find(x=>x.id===Number(buy.dataset.buy));if(p){addToCart(p.id);$("cart-name").focus();}return;}
    const add=e.target.closest("[data-add]");if(add){addToCart(Number(add.dataset.add));return;}
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
  $("admin-slots").addEventListener("change",e=>{const el=e.target.closest("[data-field]");if(!el)return;const p=prints[Number(el.dataset.index)];if(!p)return;p[el.dataset.field]=el.type==="checkbox"?el.checked:el.value;persistPrints();});
  $("admin-slots").addEventListener("input",e=>{const el=e.target.closest("input[data-field],textarea[data-field]");if(!el||el.type==="checkbox")return;const p=prints[Number(el.dataset.index)];if(!p)return;p[el.dataset.field]=el.value;writeStorage(STORAGE.prints,prints);renderCatalog();});
  function resizeImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{
        const max=900, scale=Math.min(1,max/Math.max(img.width,img.height));
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
    try{
      const dataUrl=await resizeImage(file);
      try{
        const body=new FormData();
        body.append("file",await (await fetch(dataUrl)).blob(),"print.jpg");
        body.append("upload_preset",CLOUDINARY.uploadPreset);
        const res=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,{method:"POST",body});
        const json=await res.json();
        if(!res.ok||!json.secure_url) throw new Error((json.error&&json.error.message)||"Upload failed");
        p.image=json.secure_url.replace("/upload/","/upload/f_auto,q_auto,w_900/");
      }catch(err){
        p.image=dataUrl;
        showStatus("Saved on this device only","Cloudinary upload failed ("+err.message+"), so the photo was kept in this browser only.");
      }
      persistPrints();
    }catch(err){ showStatus("Could not use that photo",err.message); input.value=""; }
    input.disabled=false;
  });
  $("admin-slots").addEventListener("click",e=>{
    const btn=e.target.closest("[data-clear-photo]"); if(!btn) return;
    const p=prints[Number(btn.dataset.clearPhoto)]; if(!p) return;
    p.image=""; persistPrints();
  });
  $("export-catalog").addEventListener("click",()=>{
    const q=s=>JSON.stringify(String(s==null?"":s));
    const lines=prints.map(p=>`    {id:${p.id},title:${q(p.title)},price:${q(p.price)},image:${q(String(p.image||"").startsWith("data:")?"":p.image)},desc:${q(p.desc)},featured:${p.featured?"true":"false"}}`);
    const out="  const defaultPrints = [\n"+lines.join(",\n")+"\n  ];";
    const box=$("export-box"); box.value=out; box.classList.remove("hidden"); box.select();
    try{navigator.clipboard.writeText(out).catch(()=>{});}catch{}
    const skipped=prints.filter(p=>String(p.image||"").startsWith("data:")).length;
    showStatus("Catalog copied",skipped?`Copied. ${skipped} photo(s) were saved on this device only and left blank — re-upload them to get a permanent link.`:"Copied. In script.js on GitHub, replace the whole defaultPrints list with this text and commit.");
  });
  $("year").textContent=new Date().getFullYear();
  renderCatalog(); calculate();
  // Support direct links such as #store and #admin on GitHub Pages.
  const hash=location.hash.slice(1);
  if(["home","store","admin"].includes(hash))setPage(hash);
  else if(["calculator","custom-order"].includes(hash))setPage("store",hash);
})();