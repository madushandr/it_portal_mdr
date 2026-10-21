(function () {
  "use strict";
  const config=window.PORTAL_CONFIG||{},$=function(id){return document.getElementById(id);};
  // MODULE CATALOG: each entry defines a portal section's fields and its table columns.
  const modules=[
    {key:"hardware_inventory",label:"Hardware Assets",description:"Computer, printer, phone and other IT asset register.",fields:[["asset_id","Asset ID","text",true],["asset_type","Asset type","text",true],["brand_model","Brand / model"],["serial_number","Serial number"],["assigned_employee","Assigned employee"],["location","Location"],["status","Status","select",false,["Active","In Store","Under Repair","Retired"]],["processor","Processor"],["ram","RAM"],["storage_type","Storage type"],["storage_capacity","Storage capacity"],["notes","Operational notes","textarea"]],columns:["asset_id","asset_type","brand_model","serial_number","assigned_employee","location","status"]},
    {key:"non_asset_inventory",label:"Non-Asset Details",description:"Track consumables and items outside the fixed asset register.",fields:[["record_id","Record ID"],["item_type","Item type","text",true],["item_name","Item name","text",true],["brand_model","Brand / model"],["serial_number","Serial / part number"],["quantity","Quantity","number"],["unit","Unit"],["location","Location"],["assigned_to","Assigned to"],["status","Status"],["condition","Condition"],["purchase_date","Purchase date","date"],["vendor","Vendor"],["invoice_ref","Invoice / reference"],["unit_cost","Unit cost","number"],["notes","Notes","textarea"]],columns:["record_id","item_type","item_name","quantity","unit","location","assigned_to","status"]},
    {key:"hardware_dispatch",label:"Dispatch Notes",description:"Record hardware shipments and dispatch details.",fields:[["dispatch_id","Dispatch ID"],["date","Date","date",true],["send_from","Send from","text",true],["send_to","Send to","text",true],["vendor","Vendor"],["contact_person","Contact person"],["contact_number","Contact number"],["address","Address","textarea"],["vehicle_number","Vehicle number"],["status","Status","select",false,["Pending","In Transit","Delivered","Completed"]],["notes","Notes","textarea"]],columns:["dispatch_id","date","send_from","send_to","vendor","status","vehicle_number"]},
    {key:"support_tickets",label:"IT Support Tickets",description:"Track support requests, priority, status and response.",fields:[["ticket_id","Ticket ID"],["requester_name","Requester","text",true],["location","Location","text",true],["contact","Contact"],["category","Category","select",true,["Hardware","Software","OLAX","Ihavest","Other"]],["subject","Subject","text",true],["description","Description","textarea",true],["priority","Priority","select",false,["Low","Normal","High","Urgent"]],["asset_id","Asset ID"],["status","Status","select",false,["Open","In Progress","Waiting","Closed"]],["assigned_to","Assigned to"],["response","IT response","textarea"]],columns:["ticket_id","created_at","requester_name","location","category","subject","priority","status"]},
    {key:"remote_desktop",label:"Remote Desktop",description:"Store remote support endpoint details. Limit access to approved users.",fields:[["location","Location","text",true],["computer_name","Computer name","text",true],["asset_id","Asset ID"],["software","Software","select",true,["RustDesk","AnyDesk","UltraViewer","Remote Desktop Connection"]],["remote_id","Remote ID / host"],["status","Status","select",false,["Active","Inactive","Under Maintenance"]],["notes","Notes","textarea"]],columns:["computer_name","asset_id","location","software","remote_id","status"]},
    {key:"licenses",label:"Licenses & Domains",description:"Keep a register of software licenses, subscriptions and domains.",fields:[["product","Product / service","text",true],["license_type","License type"],["license_key","License key / reference"],["assigned_user","Assigned user"],["department","Department"],["seat_count","Seats","number"],["purchase_date","Purchase date","date"],["expiry_date","Expiry date","date"],["status","Status","select",false,["Active","Expiring Soon","Expired","Cancelled"]],["notes","Notes","textarea"]],columns:["product","license_type","assigned_user","department","expiry_date","status"]},
    {key:"network_voice",label:"Network & Voice",description:"Routers, SIM cards, voice lines and network inventory.",fields:[["record_type","Record type","select",true,["Router","Data SIM","Voice Line"]],["asset_id","Asset ID"],["location","Location","text",true],["provider","Provider"],["phone_number","Phone number"],["sim_number","SIM number"],["ip_address","IP address"],["brand_model","Brand / model"],["status","Status"],["notes","Notes","textarea"]],columns:["record_type","asset_id","location","provider","phone_number","ip_address","status"]},
    {key:"toner_inventory",label:"Toner Management",description:"Track toner stock and reorder levels.",fields:[["sku","SKU","text",true],["printer_model","Printer model","text",true],["location","Location"],["stock_quantity","Stock quantity","number"],["reorder_level","Reorder level","number"],["unit_cost","Unit cost","number"],["supplier","Supplier"],["notes","Notes","textarea"]],columns:["sku","printer_model","location","stock_quantity","reorder_level","unit_cost","supplier"]},
    {key:"toner_transactions",label:"Toner Transactions",description:"Record toner receipts, issues and page counts.",fields:[["transaction_date","Date","date",true],["action","Action","select",true,["Issue","Buy / Receive"]],["sku","SKU","text",true],["quantity","Quantity","number",true],["location","Location"],["assigned_user","Assigned user"],["pages_printed","Pages printed","number"],["notes","Notes","textarea"]],columns:["transaction_date","action","sku","quantity","location","assigned_user","pages_printed"]},
    {key:"spare_parts",label:"Spare Parts",description:"Track spare-part quantities and reorder thresholds.",fields:[["part_id","Part ID"],["part_name","Part name","text",true],["category","Category"],["brand_model","Brand / model"],["specification","Specification"],["stock_quantity","Stock quantity","number"],["reorder_level","Reorder level","number"],["location","Location"],["supplier","Supplier"],["unit_cost","Unit cost","number"],["notes","Notes","textarea"]],columns:["part_id","part_name","category","stock_quantity","reorder_level","location","supplier"]},
    {key:"supplier_payments",label:"Supplier Payments",description:"Record supplier invoices and payments.",fields:[["date","Record date","date",true],["supplier_name","Supplier","text",true],["invoice_no","Invoice number"],["location","Location"],["item_name","Item / service"],["quantity","Quantity","number"],["subtotal","Subtotal","number"],["vat","VAT","number"],["payment_amount","Payment amount","number"],["paid_date","Paid date","date"],["payment_status","Payment status","select",false,["Not Paid","Part Paid","Paid"]],["notes","Notes","textarea"]],columns:["date","supplier_name","invoice_no","location","item_name","payment_amount","paid_date","payment_status"]},
    {key:"monthly_payments",label:"Monthly Payments",description:"Track recurring subscriptions, services and due dates.",fields:[["service_name","Service name","text",true],["vendor","Vendor"],["location","Location"],["frequency","Frequency","select",false,["Monthly","Quarterly","Annual","Other"]],["amount","Amount","number"],["start_date","Start date","date"],["next_due_date","Next due date","date"],["status","Status","select",false,["Active","Paused","Cancelled"]],["notes","Notes","textarea"]],columns:["service_name","vendor","location","frequency","amount","next_due_date","status"]},
    {key:"it_documents",label:"IT Documents",description:"Policies, procedures, manuals and related files.",fields:[["name","Document name","text",true],["category","Category","select",true,["Policies","Procedures","Manuals","Other"]],["tags","Tags"],["version","Version"],["department","Department"],["status","Status","select",false,["Active","Draft","Archived"]],["description","Description","textarea"]],columns:["name","category","tags","version","department","status","created_at"]},
    {key:"handover_records",label:"Handover Records",description:"Keep equipment handover details and attach signed forms.",fields:[["asset_id","Asset ID"],["brand_model","Brand / model"],["serial_number","Serial number"],["user_name","Employee name","text",true],["email","Email","email"],["designation","Designation"],["department","Department"],["location","Location"],["date_of_issue","Issue date","date"],["price","Price","number"],["warranty_period","Warranty period"],["warranty_end_date","Warranty end date","date"],["condition","Condition"],["imei","IMEI"],["os","Operating system"],["software","Software","textarea"],["accessories","Accessories","textarea"]],columns:["asset_id","brand_model","user_name","department","location","date_of_issue","condition"]},
    {key:"notification_settings",label:"Notifications",description:"Keep notification recipients and settings. Automated email sending needs a separate mail provider.",fields:[["name","Setting / recipient","text",true],["email","Email","email"],["module_name","Module"],["enabled","Enabled","select",false,["Yes","No"]],["details","Details","textarea"]],columns:["name","email","module_name","enabled","created_at"]},
    {key:"handover_settings",label:"Handover Settings",description:"Store handover instruction text and process notes.",fields:[["title","Title","text",true],["content","Instructions","textarea",true],["updated_by","Updated by"]],columns:["title","updated_by","updated_at"]}
  ];
  // SESSION STATE: the signed-in account, its portal profile, current section, and loaded rows.
  let client=null,session=null,profile=null,activeModule=null,records=[],specialRows=[],editingRow=null;
  const specialModules=new Set(["user_management","activity_log"]);
  // SHARED HELPERS: safe HTML display, messages, profile permissions, and module access labels.
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function show(el,text){el.textContent=text||"";el.classList.toggle("hidden",!text);}
  function notify(text){show($("globalMessage"),text);$("globalError").classList.add("hidden");window.setTimeout(function(){$("globalMessage").classList.add("hidden");},5500);}
  function fail(text){show($("globalError"),text);$("globalMessage").classList.add("hidden");}
  function can(key,action){return !!(profile&&(profile.is_admin||(profile.permissions&&profile.permissions[key]&&profile.permissions[key][action]===true)));}
  function getModule(key){
    if(key==="user_management")return {key:key,label:"System Users",description:"Create staff logins and choose which portal modules they can use.",columns:["username","full_name","is_admin","permissions"],fields:[]};
    if(key==="activity_log")return {key:key,label:"Activity Log",description:"Audit trail of changes made in this portal.",columns:["created_at","module","action","record_id","actor_id"],fields:[]};
    return modules.find(function(m){return m.key===key;});
  }
  function availableModules(){let out=modules.filter(function(m){return can(m.key,"view");});if(can("user_management","view"))out.push(getModule("user_management"));if(can("activity_log","view"))out.push(getModule("activity_log"));return out;}
  function displayValue(v){if(v==null||v==="")return "—";if(typeof v==="object")return JSON.stringify(v);return String(v);}
  function permissionSummary(p){return Object.keys(p||{}).filter(function(k){return p[k]&&p[k].view;}).join(", ")||"No module access";}
  const accessLabels={hardware_inventory:"Hardware Assets",non_asset_inventory:"Non-Asset Details (Records)",hardware_dispatch:"Hardware Asset Dispatch",support_tickets:"IT Support Tickets",remote_desktop:"Remote Desktop",licenses:"Licenses & Domains",network_voice:"Network & Voice",toner_inventory:"Toner Management",toner_transactions:"Toner Transactions",spare_parts:"Spare Parts Stock",supplier_payments:"Supplier Payments / Finance",monthly_payments:"Telecom Monthly Payments",it_documents:"IT Documents",handover_records:"Handover Records",notification_settings:"Notifications",handover_settings:"Handover Settings"};
  function permissionLevel(p,key,isAdmin){if(isAdmin)return "edit";const x=p&&p[key];return x&&x.edit===true?"edit":x&&x.view===true?"view":"none";}
  function showLogin(){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");$("loginForm").reset();}
  function showApp(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("who").textContent=(profile.full_name||profile.username||session.user.email)+" · "+(profile.is_admin?"Administrator":"Portal user");buildNavigation();show($("globalError"),"");show($("globalMessage"),"");showDashboard();}
  // NAVIGATION AND DASHBOARD: show only permitted modules and display their Supabase record counts.
  function buildNavigation(){
    const entries=[{key:"dashboard",label:"Overview"}].concat(availableModules());
    $("moduleNav").innerHTML=entries.map(function(e){return '<button type="button" data-nav="'+esc(e.key)+'">'+esc(e.label)+"</button>";}).join("");
    $("moduleNav").querySelectorAll("[data-nav]").forEach(function(b){b.addEventListener("click",function(){if(b.dataset.nav==="dashboard")showDashboard();else openModule(b.dataset.nav);});});
  }
  async function showDashboard(){
    activeModule=null;$("dashboardView").classList.remove("hidden");$("moduleView").classList.add("hidden");
    $("moduleNav").querySelectorAll("button").forEach(function(b){b.classList.toggle("active",b.dataset.nav==="dashboard");});
    const list=availableModules().slice(0,4);
    const counts=await Promise.all(list.map(async function(m){
      let q=m.key==="activity_log"?client.from("portal_activity_log").select("id",{count:"exact",head:true}):
        m.key==="user_management"?client.from("portal_profiles").select("id",{count:"exact",head:true}):
        client.from("portal_records").select("id",{count:"exact",head:true}).eq("module",m.key);
      const r=await q;return {label:m.label,count:r.count||0};
    }));
    $("stats").innerHTML=counts.map(function(x){return '<div class="stat"><strong>'+esc(x.count)+'</strong><span>'+esc(x.label)+'</span></div>';}).join("")||'<div class="card">No modules have been assigned to this account yet.</div>';
  }
  async function openModule(key){
    if(!can(key,"view")){fail("You do not have permission to view this module.");return;}
    activeModule=getModule(key);if(!activeModule){fail("This module is not configured.");return;}
    $("dashboardView").classList.add("hidden");$("moduleView").classList.remove("hidden");
    $("moduleTitle").textContent=activeModule.label;$("moduleDescription").textContent=activeModule.description;
    $("moduleNav").querySelectorAll("button").forEach(function(b){b.classList.toggle("active",b.dataset.nav===key);});
    $("addRecordButton").classList.toggle("hidden",!can(key,"edit")||key==="activity_log");$("addRecordButton").textContent=key==="user_management"?"+ Register System User":"+ New record";
    $("moduleNotice").classList.toggle("hidden",!(key==="user_management"||key==="activity_log"));
    if(key==="user_management")$("moduleNotice").textContent="Use Register System User to create a staff login and select module access. Staff sign in with their username and password.";
    if(key==="activity_log")$("moduleNotice").textContent="Read-only audit entries are created automatically when portal records change.";
    $("recordSearch").value="";await loadModuleRecords();
  }
  async function loadModuleRecords(){
    if(!activeModule)return;$("recordRows").innerHTML='<tr><td class="empty" colspan="20">Loading…</td></tr>';
    let result;
    if(activeModule.key==="activity_log"){result=await client.from("portal_activity_log").select("id,actor_id,module,action,record_id,details,created_at").order("created_at",{ascending:false}).limit(500);specialRows=result.data||[];}
    else if(activeModule.key==="user_management"){result=await client.from("portal_profiles").select("id,username,full_name,is_admin,permissions,created_at,updated_at").order("username",{ascending:true}).limit(500);specialRows=result.data||[];}
    else{result=await client.from("portal_records").select("id,module,data,created_at,updated_at").eq("module",activeModule.key).order("updated_at",{ascending:false}).limit(500);records=result.data||[];}
    if(result.error){fail(result.error.message);$("recordRows").innerHTML='<tr><td class="empty" colspan="20">Could not load records.</td></tr>';return;}
    await renderRows();
  }
  // TABLE RENDERING: format module rows, search results, file counts, and available edit buttons.
  function rowObject(r){
    if(activeModule.key==="activity_log")return {id:r.id,created_at:r.created_at,module:r.module,action:r.action,record_id:r.record_id,actor_id:r.actor_id,details:r.details};
    if(activeModule.key==="user_management")return {id:r.id,username:r.username,full_name:r.full_name,is_admin:r.is_admin,permissions:permissionSummary(r.permissions),_profile:r};
    return Object.assign({id:r.id,created_at:r.created_at,updated_at:r.updated_at},r.data||{});
  }
  async function renderRows(){
    const isSpecial=specialModules.has(activeModule.key),list=isSpecial?specialRows:records,query=$("recordSearch").value.trim().toLowerCase(),cols=activeModule.columns||[];
    $("recordHead").innerHTML="<tr>"+cols.map(function(c){return "<th>"+esc(labelFor(c))+"</th>";}).join("")+(activeModule.key==="activity_log"?"":"<th>Files</th>")+(can(activeModule.key,"edit")&&activeModule.key!=="activity_log"?"<th>Actions</th>":"")+"</tr>";
    const visible=list.map(rowObject).filter(function(o){return JSON.stringify(o).toLowerCase().includes(query);});
    $("recordCount").textContent=visible.length+(visible.length===1?" record":" records");
    if(!visible.length){$("recordRows").innerHTML='<tr><td class="empty" colspan="'+(cols.length+2)+'">No records found.</td></tr>';return;}
    let counts={};
    if(!isSpecial){const f=await client.from("portal_files").select("record_id").eq("module",activeModule.key).in("record_id",visible.map(function(o){return o.id;}));if(!f.error)(f.data||[]).forEach(function(x){counts[x.record_id]=(counts[x.record_id]||0)+1;});}
    $("recordRows").innerHTML=visible.map(function(o){
      const cells=cols.map(function(c){let v=o[c];if(c==="is_admin")v=v?"Administrator":"Staff";if(c==="details"&&typeof v==="object")v=JSON.stringify(v);return "<td>"+esc(displayValue(v))+"</td>";}).join("");
      const files=activeModule.key==="activity_log"?"":"<td>"+(counts[o.id]||0)+"</td>";
      let actions="";
      if(activeModule.key==="user_management"&&can("user_management","edit"))actions='<button class="button secondary small" data-edit-profile="'+esc(o.id)+'">Edit</button>';
      else if(!isSpecial&&can(activeModule.key,"edit"))actions='<div class="row-actions"><button class="button secondary small" data-edit="'+esc(o.id)+'">Open / Edit</button><button class="button danger small" data-delete="'+esc(o.id)+'">Delete</button></div>';
      const actionCell=activeModule.key==="activity_log"?"":"<td>"+actions+"</td>";
      return "<tr>"+cells+files+actionCell+"</tr>";
    }).join("");
    $("recordRows").querySelectorAll("[data-edit]").forEach(function(b){b.addEventListener("click",function(){openRecordModal(records.find(function(r){return r.id===b.dataset.edit;}));});});
    $("recordRows").querySelectorAll("[data-delete]").forEach(function(b){b.addEventListener("click",function(){deleteRecord(b.dataset.delete);});});
    $("recordRows").querySelectorAll("[data-edit-profile]").forEach(function(b){b.addEventListener("click",function(){openProfileModal(specialRows.find(function(r){return r.id===b.dataset.editProfile;}));});});
  }
  function labelFor(k){
    const names={created_at:"Created",updated_at:"Updated",record_id:"Record ID",actor_id:"User ID",is_admin:"Role",brand_model:"Brand / Model",serial_number:"Serial number",assigned_employee:"Assigned to",assigned_user:"Assigned user",assigned_to:"Assigned to",payment_amount:"Amount",date_of_issue:"Issue date",expiry_date:"Expiry date",remote_id:"Remote ID",stock_quantity:"Stock",reorder_level:"Reorder level",transaction_date:"Transaction date",invoice_no:"Invoice",send_from:"Send from",send_to:"Send to",full_name:"Full name",user_name:"Employee"};
    return names[k]||k.replace(/_/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();});
  }
  function fieldMarkup(f,v){
    const key=f[0],label=f[1],type=f[2]||"text",required=!!f[3],opts=f[4]||[],attr=required?" required":"",val=v==null?"":String(v);
    if(type==="textarea")return '<div class="field wide"><label for="f_'+esc(key)+'">'+esc(label)+(required?" *":"")+'</label><textarea id="f_'+esc(key)+'" data-field="'+esc(key)+'"'+attr+'>'+esc(val)+'</textarea></div>';
    if(type==="select")return '<div class="field"><label for="f_'+esc(key)+'">'+esc(label)+(required?" *":"")+'</label><select id="f_'+esc(key)+'" data-field="'+esc(key)+'"'+attr+'><option value="">Choose…</option>'+opts.map(function(o){return '<option value="'+esc(o)+'"'+(String(o)===val?" selected":"")+'>'+esc(o)+"</option>";}).join("")+"</select></div>";
    return '<div class="field"><label for="f_'+esc(key)+'">'+esc(label)+(required?" *":"")+'</label><input id="f_'+esc(key)+'" data-field="'+esc(key)+'" type="'+esc(type)+'" value="'+esc(val)+'"'+attr+"></div>";
  }
  // RECORD AND USER FORMS: build either a normal module form or the Register System User panel.
  function openRecordModal(row){
    $("recordModalBox").classList.remove("user-modal");$("closeModalButton").textContent="Close";$("saveRecordButton").textContent="Save record";
    editingRow=row||null;const data=row&&row.data?row.data:{};
    $("recordModalTitle").textContent=row?"Edit "+activeModule.label:"New "+activeModule.label+" record";
    $("recordModalSubtitle").textContent=row?"Record ID: "+row.id:"Complete details and save.";
    $("recordFields").innerHTML=activeModule.fields.map(function(f){return fieldMarkup(f,data[f[0]]);}).join("");
    $("attachmentSection").classList.remove("hidden");$("fileInput").value="";$("generatePdfButton").classList.toggle("hidden",!row);
    show($("modalError"),"");$("recordModal").classList.remove("hidden");$("recordForm").onsubmit=saveRecord;loadExistingFiles(row&&row.id);
  }
  function openProfileModal(row){
    editingRow=row||null;const p=row||{},levels=modules.map(function(m){const key=m.key,label=accessLabels[key]||m.label,value=permissionLevel(p.permissions,key,!!p.is_admin),hint=key==="support_tickets"?"Full Edit lets staff manage all tickets.":"";return '<div class="user-access-row"><div>'+esc(label)+(hint?'<small>'+esc(hint)+"</small>":"")+'</div><div><label class="sr-only" for="user_access_'+esc(key)+'">'+esc(label)+' access</label><select id="user_access_'+esc(key)+'" data-access-module="'+esc(key)+'"><option value="none"'+(value==="none"?" selected":"")+'>No Access</option><option value="view"'+(value==="view"?" selected":"")+'>View Only</option><option value="edit"'+(value==="edit"?" selected":"")+'>Full Edit</option></select></div></div>';}).join("");
    $("recordModalBox").classList.add("user-modal");$("closeModalButton").textContent="×";$("recordModalTitle").textContent=row?"Edit System User":"Register System User";$("recordModalSubtitle").textContent="";
    $("recordFields").innerHTML='<div class="user-top-fields"><label class="sr-only" for="user_username">Username (lowercase)</label><input class="user-input" id="user_username" type="text" autocomplete="off" autocapitalize="none" placeholder="Username (Lowercase)" pattern="[a-z0-9][a-z0-9._-]{3,31}" title="Use 4–32 lowercase letters, numbers, dots, underscores or hyphens." required value="'+esc(p.username||"")+'">'+(row?"":'<label class="sr-only" for="user_password">Password</label><input class="user-input" id="user_password" type="password" autocomplete="new-password" minlength="8" placeholder="Password (at least 8 characters)" required>')+'<label class="sr-only" for="user_full_name">Full Name</label><input class="user-input" id="user_full_name" type="text" autocomplete="name" placeholder="Full Name" required value="'+esc(p.full_name||"")+'"></div><div class="user-access-box"><div class="user-access-title">Module Access Allocation</div><div class="user-access-help">Set each module independently: no access, view only, or full edit.</div><div class="user-access-list">'+levels+'</div></div>'+(row&&p.is_admin?'<div class="subtle" style="margin:0 0 12px">This account is an administrator; its administrator access remains enabled.</div>':"");
    $("attachmentSection").classList.add("hidden");$("generatePdfButton").classList.add("hidden");$("saveRecordButton").textContent=row?"Save User Changes":"Create Authorized User";show($("modalError"),"");$("recordModal").classList.remove("hidden");$("recordForm").onsubmit=saveProfile;
  }
  async function loadExistingFiles(recordId){
    $("existingFiles").innerHTML="";if(!recordId||!activeModule||specialModules.has(activeModule.key))return;
    const r=await client.from("portal_files").select("id,original_name,size_bytes,created_at").eq("record_id",recordId).order("created_at",{ascending:false});
    if(r.error){show($("modalError"),"Could not list files: "+r.error.message);return;}
    $("existingFiles").innerHTML=(r.data||[]).map(function(f){return '<div class="file-item"><span>'+esc(f.original_name)+' <span class="subtle">('+formatSize(f.size_bytes)+')</span></span><span class="row-actions"><button type="button" class="button secondary small" data-download-file="'+esc(f.id)+'">Download</button><button type="button" class="button danger small" data-remove-file="'+esc(f.id)+'">Remove</button></span></div>';}).join("")||'<div class="subtle">No files attached yet.</div>';
    $("existingFiles").querySelectorAll("[data-download-file]").forEach(function(b){b.addEventListener("click",function(){downloadFile(b.dataset.downloadFile);});});
    $("existingFiles").querySelectorAll("[data-remove-file]").forEach(function(b){b.addEventListener("click",function(){removeFile(b.dataset.removeFile);});});
  }
  function formatSize(n){n=Number(n)||0;if(n<1024)return n+" B";if(n<1048576)return(n/1024).toFixed(1)+" KB";return(n/1048576).toFixed(1)+" MB";}
  function getFormData(){
    const out={};$("recordFields").querySelectorAll("[data-field]").forEach(function(el){out[el.dataset.field]=el.value.trim();});
    activeModule.fields.forEach(function(f){if(f[2]==="number"&&out[f[0]]!=="")out[f[0]]=Number(out[f[0]]);});return out;
  }
  async function saveRecord(e){
    e.preventDefault();if(!activeModule||!can(activeModule.key,"edit"))return;
    const btn=$("saveRecordButton");btn.disabled=true;btn.textContent="Saving…";show($("modalError"),"");
    const payload={data:getFormData()};let r=editingRow?await client.from("portal_records").update(payload).eq("id",editingRow.id).select("id,module,data,created_at,updated_at").single():await client.from("portal_records").insert({module:activeModule.key,data:payload.data}).select("id,module,data,created_at,updated_at").single();
    btn.disabled=false;btn.textContent="Save record";if(r.error){show($("modalError"),r.error.message);return;}
    const saved=r.data;
    try{for(const file of Array.from($("fileInput").files||[]))await uploadDriveFile(file,activeModule.key,saved.id);}
    catch(err){show($("modalError"),"Record saved, but file upload failed: "+err.message);await loadExistingFiles(saved.id);return;}
    $("recordModal").classList.add("hidden");notify("Record saved.");await loadModuleRecords();
  }
  // USER MANAGEMENT: send account creation/profile updates to the protected Supabase Edge Function.
  async function saveProfile(e){
    e.preventDefault();if(!can("user_management","edit"))return;
    const username=$("user_username").value.trim().toLowerCase(),fullName=$("user_full_name").value.trim(),password=$("user_password")?$("user_password").value:"";
    if(!/^[a-z0-9][a-z0-9._-]{3,31}$/.test(username)){show($("modalError"),"Username must be 4–32 lowercase letters, numbers, dots, underscores or hyphens.");return;}
    if(!editingRow&&password.length<8){show($("modalError"),"Password must be at least 8 characters.");return;}
    const access={};$("recordFields").querySelectorAll("[data-access-module]").forEach(function(el){if(el.value!=="none")access[el.dataset.accessModule]=el.value;});
    const btn=$("saveRecordButton");btn.disabled=true;btn.textContent=editingRow?"Saving…":"Creating…";show($("modalError"),"");
    try{await managePortalUser(editingRow?"update":"create",{userId:editingRow&&editingRow.id,username:username,fullName:fullName,password:editingRow?undefined:password,access:access});
      $("recordModal").classList.add("hidden");notify(editingRow?"User profile updated.":"Authorized user created. They can sign in with their username and password.");await loadModuleRecords();buildNavigation();
    }catch(err){show($("modalError"),err.message||"Could not save this user.");}
    btn.disabled=false;btn.textContent=editingRow?"Save User Changes":"Create Authorized User";
  }
  async function managePortalUser(action,payload){
    const r=await fetch(config.supabaseUrl+"/functions/v1/manage-users",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action:action},payload||{}))});
    const data=await parseResponse(r);if(!r.ok)throw new Error(data.error||"User management request failed.");return data;
  }
  async function parseResponse(r){const t=r.headers.get("content-type")||"";if(t.includes("application/json"))return await r.json();return {error:(await r.text())||r.statusText};}
  // GOOGLE DRIVE FILES: authenticated requests for upload, download, and removal of private attachments.
  async function driveRequest(action,payload){
    const r=await fetch(config.supabaseUrl+"/functions/v1/drive-files",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action:action},payload||{}))});
    const data=await parseResponse(r);if(!r.ok)throw new Error(data.error||"Google Drive request failed.");return data;
  }
  async function uploadDriveFile(file,moduleKey,recordId){
    if(file.size>(Number(config.maxFileBytes)||20971520))throw new Error(file.name+" exceeds the file-size limit.");
    const form=new FormData();form.append("action","upload");form.append("module",moduleKey);form.append("recordId",recordId);form.append("file",file,file.name);
    const r=await fetch(config.supabaseUrl+"/functions/v1/drive-files",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token},body:form});
    const data=await parseResponse(r);if(!r.ok)throw new Error(data.error||"Google Drive upload failed.");return data;
  }
  async function downloadFile(fileId){
    try{const r=await fetch(config.supabaseUrl+"/functions/v1/drive-files",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"download",fileId:fileId})});
      if(!r.ok){const e=await parseResponse(r);throw new Error(e.error||"Download failed.");}
      const blob=await r.blob(),disposition=r.headers.get("content-disposition")||"",m=disposition.match(/filename="?([^";]+)"?/i),name=m?m[1]:"portal-file";
      const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){fail(e.message);}
  }
  async function removeFile(fileId){
    if(!window.confirm("Remove this file from the portal and Google Drive?"))return;
    try{await driveRequest("delete",{fileId:fileId});await loadExistingFiles(editingRow.id);notify("File removed.");}catch(e){show($("modalError"),e.message);}
  }
  async function deleteRecord(id){
    const row=records.find(function(r){return r.id===id;});if(!row||!window.confirm("Delete this record and its linked files?"))return;
    const f=await client.from("portal_files").select("id").eq("record_id",id);if(f.error){fail(f.error.message);return;}
    try{for(const file of f.data||[])await driveRequest("delete",{fileId:file.id});}
    catch(e){fail("Could not remove all linked files: "+e.message);return;}
    const r=await client.from("portal_records").delete().eq("id",id);if(r.error){fail(r.error.message);return;}
    notify("Record deleted.");await loadModuleRecords();
  }
  // PDF AND CSV TOOLS: make a basic record PDF and export the current table as CSV.
  async function generatePdf(){
    if(!editingRow){show($("modalError"),"Save the record before generating a PDF.");return;}
    if(!window.jspdf||!window.jspdf.jsPDF){show($("modalError"),"PDF library did not load. Check internet and retry.");return;}
    const btn=$("generatePdfButton");btn.disabled=true;btn.textContent="Creating PDF…";
    try{
      const values=getFormData(),doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});let y=20;
      doc.setFontSize(16);doc.text(activeModule.label+" Form",15,y);y+=11;doc.setFontSize(9);doc.text("Record ID: "+editingRow.id,15,y);y+=9;
      activeModule.fields.forEach(function(f){const lines=doc.splitTextToSize(f[1]+": "+displayValue(values[f[0]]),175);if(y+lines.length*5>280){doc.addPage();y=18;}doc.setFontSize(10);doc.text(lines,15,y);y+=Math.max(lines.length*5,7);});
      const blob=doc.output("blob");await uploadDriveFile(new File([blob],activeModule.key+"-"+editingRow.id+".pdf",{type:"application/pdf"}),activeModule.key,editingRow.id);
      await loadExistingFiles(editingRow.id);notify("PDF form generated and stored in Google Drive.");
    }catch(e){show($("modalError"),"Could not generate or upload PDF: "+e.message);}
    btn.disabled=false;btn.textContent="Generate PDF form";
  }
  function exportCsv(){
    if(!activeModule)return;const cols=activeModule.columns||[],list=specialModules.has(activeModule.key)?specialRows:records.map(rowObject);
    const lines=[cols.map(labelFor).join(",")].concat(list.map(function(o){return cols.map(function(k){return '"'+String(displayValue(o[k])).replace(/"/g,'""')+'"';}).join(",");}));
    const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=activeModule.key+".csv";a.click();URL.revokeObjectURL(a.href);
  }
  // SUPABASE AUTH: email or username sign-in, portal profile loading, sign-out, and initial UI wiring.
  async function signIn(e){
    e.preventDefault();show($("loginError"),"");const b=$("loginButton");b.disabled=true;b.textContent="Signing in…";
    const entered=$("email").value.trim(),email=entered.indexOf("@")>=0?entered:entered.toLowerCase()+"@portal.hpl.invalid";
    const r=await client.auth.signInWithPassword({email:email,password:$("password").value});b.disabled=false;b.textContent="Sign in";
    if(r.error){show($("loginError"),r.error.message);return;}await loadCurrentProfile(r.data.session);
  }
  async function loadCurrentProfile(next){
    session=next;if(!session){profile=null;showLogin();return;}
    const r=await client.from("portal_profiles").select("id,username,full_name,is_admin,permissions").eq("id",session.user.id).maybeSingle();
    if(r.error||!r.data){await client.auth.signOut();showLogin();show($("loginError"),"This Auth account has no portal profile yet. Ask the administrator to add it.");return;}
    profile=r.data;showApp();
  }
  async function signOut(){await client.auth.signOut();session=null;profile=null;showLogin();}
  function init(){
    if(!window.supabase||!config.supabaseUrl||!config.publishableKey||config.supabaseUrl.includes("YOUR-")||config.publishableKey.startsWith("YOUR_")){
      $("setupNotice").textContent="Setup needed: update site/config.js with your Supabase Project URL and publishable key.";$("setupNotice").classList.remove("hidden");$("loginButton").disabled=true;return;
    }
    client=window.supabase.createClient(config.supabaseUrl,config.publishableKey);
    $("loginForm").addEventListener("submit",signIn);$("signOutButton").addEventListener("click",signOut);
    $("addRecordButton").addEventListener("click",function(){if(activeModule.key==="user_management")openProfileModal(null);else openRecordModal(null);});
    $("closeModalButton").addEventListener("click",function(){$("recordModal").classList.add("hidden");});
    $("recordSearch").addEventListener("input",renderRows);$("exportButton").addEventListener("click",exportCsv);$("generatePdfButton").addEventListener("click",generatePdf);
    $("recordModal").addEventListener("click",function(e){if(e.target===$("recordModal"))$("recordModal").classList.add("hidden");});
    client.auth.getSession().then(function(r){if(r.data&&r.data.session)loadCurrentProfile(r.data.session);});
    client.auth.onAuthStateChange(function(_event,next){if(next)loadCurrentProfile(next);else if(session){session=null;profile=null;showLogin();}});
  }
  init();
})();
