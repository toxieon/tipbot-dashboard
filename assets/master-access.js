/* Owner-only master access UI. Uses the existing page's tokens and API client. */
(function (root) {
  "use strict";
  // Action sheet when tb-motion.js is loaded (0.43.1); plain confirm() otherwise.
  function ask(o) {
    var W = typeof window !== "undefined" ? window : {};
    if (W.TBSheet && W.TBSheet.confirm) return W.TBSheet.confirm(o);
    return Promise.resolve(typeof W.confirm === "function" ? W.confirm(o.title + (o.message ? "\n\n" + o.message : "")) : false);
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function parseTargets(text) {
    if (!text.trim()) return [];
    return text.split(",").map(function (part) {
      var m = part.trim().match(/^(channel|category|source_guild):([1-9][0-9]*)$/);
      if (!m) throw new Error("Use channel:ID, category:ID or source_guild:ID, separated by commas.");
      return {target_type:m[1], target_id:m[2]};
    });
  }
  function permissions(value) {
    if(!value)return 'No overwrite';
    return Object.keys(value.permissions||{}).map(function(key){return key.replace(/_/g,' ')+': '+(value.permissions[key]?'allow':'deny');}).join('; ') || 'No explicit permissions';
  }
  function create(options) {
    var call=options.call, paint=options.paint, cfg=options.config;
    var state={entries:null, events:null, review:null, roleLock:true, busy:false, message:"", error:false,
      filter:"", next:null, action:null, unavailable:false};
    function $(id) { return document.getElementById(id); }
    function note() { return state.message ? '<div class="banner '+(state.error?'err':'ok')+'" role="status">'+esc(state.message)+'</div>' : ''; }
    function assert(result) {
      if (!result.ok) {
        if ([404,405,501].indexOf(result._status)!==-1) state.unavailable=true;
        throw new Error(state.unavailable ? "This needs TipBot’s lockdown deploy. Refresh after it lands." : result.error || "Request failed. Try again.");
      }
      return result;
    }
    async function run(fn) {
      if (state.busy) return;
      state.busy=true;state.message="";paint();
      try { await fn();state.error=false; }
      catch (e) { state.message=e.message || "Could not reach TipBot.";state.error=true; }
      finally { state.busy=false;paint(); }
    }
    function unavailable() {
      return '<section class="card empty">This needs TipBot’s lockdown deploy. Refresh after it lands.</section>';
    }
    function lockdown() {
      if (state.unavailable || !(cfg().built||{}).lockdown) return unavailable();
      var c=cfg().config||{}, plan=state.review&&state.review.plan;
      var html='<section class="card"><h2>Lockdown & access</h2><p>Only you, TipBot and whitelisted members should see these channels. Administrator roles always bypass channel privacy.</p>'
        +'<p class="note">Permission repair runs every 10 minutes and after channel changes. Member checks run every 5 minutes; counts are approximate without the Members intent.</p>'
        +'<p>Last member count: '+esc(c.known_member_count==null?'Not checked yet':c.known_member_count)+'</p>'
        +'<label class="switch"><input id="lock-role" type="checkbox"'+(state.roleLock?' checked':'')+(state.busy?' disabled':'')+'> Remove View Channels from the @everyone role</label>'
        +'<p class="note">This also changes the server’s default role. Review the separate role change below before applying.</p>'
        +'<div class="row access-actions"><button class="btn ghost" id="lock-preview"'+(state.busy?' disabled':'')+'>Preview permission changes</button>'
        +(c.lockdown_enabled?'<button class="btn ghost" id="lock-pause"'+(state.busy?' disabled':'')+'>Pause repair</button>':'')+'</div>'
        +'<p class="note">Pausing repair leaves the current Discord permissions in place.</p></section>';
      if (plan) {
        html+='<section class="card"><h2>Review changes</h2><p>'+esc(plan.changed_channels)+' of '+esc(plan.channels.length)+' channels need changes.</p>'
          +'<p>Default role: '+(plan.everyone_role.changed?'remove View Channels':'no change')+'</p>'
          +(plan.admin_roles.length?'<div class="banner err">Administrator roles can see every channel: '+plan.admin_roles.map(function(r){return esc(r.name)+' ('+esc(r.id)+')';}).join(', ')+'</div>':'<p>No other Administrator roles were found.</p>')
          +plan.channels.map(function(ch){return '<details class="access-diff"><summary>'+esc(ch.name)+' · '+ch.changes.length+' change(s)</summary>'
            +'<ul>'+ch.changes.map(function(change){return '<li>'+esc(change.operation)+' '+esc(change.target)+'<p class="note">Before: '+esc(permissions(change.before))+'</p><p class="note">After: '+esc(permissions(change.after))+'</p></li>';}).join('')+'</ul></details>';}).join('')
          +'<button class="btn access-actions" id="lock-apply"'+(state.busy?' disabled':'')+'>Confirm and apply lockdown</button><p class="note">A review expires after 10 minutes. Any intervening permission or whitelist change requires a new preview.</p></section>';
      }
      html+='<section class="card"><h2>Whitelist</h2><p class="note">Read-only by default. Saving applies changes to affected channels while lockdown is active. Saved entries also take effect on the next reviewed apply.</p>'
        +'<form id="whitelist-form" class="access-form"><label>Discord user ID<input id="access-user" required inputmode="numeric" pattern="[1-9][0-9]*" autocomplete="off"></label>'
        +'<label>Label<input id="access-label" maxlength="100"></label><label>Scope<select id="access-scope"><option value="all">All master channels</option><option value="limited">Selected channels, categories or source servers</option></select></label>'
        +'<label>Scope targets<input id="access-targets" placeholder="channel:123, category:456, source_guild:789"></label>'
        +'<label class="switch"><input id="access-send" type="checkbox"> Allow posting</label>'
        +'<button class="btn"'+(state.busy?' disabled':'')+'>Save member</button></form>'
        +(state.entries===null?'<p>Loading whitelist…</p>':state.entries.length?'<div class="access-table"><table><thead><tr><th>Member</th><th>Access</th><th>Scope</th><th>Actions</th></tr></thead><tbody>'
          +state.entries.map(function(e){return '<tr><td>'+esc(e.label||'Member')+'<br><code>'+esc(e.user_id)+'</code></td><td>'+(e.can_send?'Can post':'Read-only')+'</td><td>'+esc(e.scope==='all'?'All channels':e.targets.map(function(t){return t.target_type+':'+t.target_id;}).join(', '))+'</td><td><button class="btn ghost" data-access-edit="'+esc(e.user_id)+'"'+(state.busy?' disabled':'')+'>Edit</button> <button class="btn ghost" data-access-remove="'+esc(e.user_id)+'"'+(state.busy?' disabled':'')+'>Remove</button></td></tr>';}).join('')+'</tbody></table></div>':'<p>No whitelisted members.</p>')+'</section>';
      if(state.action) html+='<section class="card"><h2>Last queued action</h2><p>'+esc(state.action.status)+' '+esc(state.action.result||'')+'</p><button class="btn ghost" id="access-action"'+(state.busy?' disabled':'')+'>Refresh action status</button></section>';
      return html+note();
    }
    function audit() {
      if (state.unavailable || !(cfg().built||{}).lockdown) return unavailable();
      return '<section class="card"><h2>Audit log</h2><form id="event-filter" class="row"><label>Event name<input id="event-name" value="'+esc(state.filter)+'" placeholder="drift_fixed"></label><button class="btn ghost"'+(state.busy?' disabled':'')+'>Filter / refresh</button></form>'
        +(state.events===null?'<p>Loading events…</p>':!state.events.length?'<p>No matching events.</p>':state.events.map(function(e){return '<details class="access-diff"><summary>'+esc(e.event)+' · '+esc(e.created_at)+'</summary><p>Server '+esc(e.guild_id||'—')+' · actor '+esc(e.actor_id||'system')+'</p><pre>'+esc(JSON.stringify(e.detail,null,2))+'</pre></details>';}).join(''))
        +(state.next?'<button class="btn ghost" id="event-more"'+(state.busy?' disabled':'')+'>Older events</button>':'')+'</section>'+note();
    }
    async function refreshEvents(older) {
      var r=assert(await call('/api/master/events?limit=50&event='+encodeURIComponent(state.filter)+(older&&state.next?'&before='+state.next:'')));
      state.events=older?(state.events||[]).concat(r.events):r.events;state.next=r.events.length===50?r.next_before:null;
    }
    function bind(tab) {
      if (tab==='audit') {
        var filter=$('event-filter');if(filter)filter.onsubmit=function(e){e.preventDefault();state.filter=$('event-name').value.trim();run(function(){return refreshEvents(false);});};
        var more=$('event-more');if(more)more.onclick=function(){run(function(){return refreshEvents(true);});};
        return;
      }
      if(tab!=='lockdown')return;
      var role=$('lock-role');if(role)role.onchange=function(){state.roleLock=role.checked;state.review=null;paint();};
      var preview=$('lock-preview');if(preview)preview.onclick=function(){run(async function(){state.review=assert(await call('/api/master/lockdown',{dry_run:true,lock_everyone_role:state.roleLock}));});};
      var apply=$('lock-apply');if(apply)apply.onclick=function(){
        ask({title:'Apply the reviewed permission changes?',message:'This changes Discord permissions on the master server.'+(state.roleLock?' It includes removing View Channels from @everyone.':''),confirmLabel:'Apply changes',destructive:!!state.roleLock}).then(function(ok){ if(!ok)return;
        run(async function(){var r=assert(await call('/api/master/lockdown',{dry_run:false,lock_everyone_role:state.roleLock,review_token:state.review.review_token,confirmed:true}));state.action={id:r.action_id,status:'queued'};state.review=null;state.message='Lockdown queued. Refresh the action status to check completion.';}); });
      };
      var pause=$('lock-pause');if(pause)pause.onclick=function(){run(async function(){var r=assert(await call('/api/master/config',{lockdown_enabled:false}));cfg().config=r.config;state.review=null;state.message='Permission repair paused; existing permissions remain applied.';});};
      var form=$('whitelist-form');if(form)form.onsubmit=function(e){
        e.preventDefault();
        var data;
        try { data={user_id:$('access-user').value.trim(),label:$('access-label').value,scope:$('access-scope').value,can_send:$('access-send').checked,targets:$('access-scope').value==='limited'?parseTargets($('access-targets').value):[]}; }
        catch(err){state.error=true;state.message=err.message;paint();return;}
        run(async function(){var r=assert(await call('/api/master/whitelist',data));state.entries=r.entries;state.review=null;state.action={id:r.action_id,status:'queued'};state.message='Whitelist saved.';});
      };
      document.querySelectorAll('[data-access-edit]').forEach(function(b){b.onclick=function(){var e=state.entries.find(function(row){return row.user_id===b.dataset.accessEdit;});$('access-user').value=e.user_id;$('access-label').value=e.label||'';$('access-scope').value=e.scope;$('access-send').checked=!!e.can_send;$('access-targets').value=e.targets.map(function(t){return t.target_type+':'+t.target_id;}).join(', ');$('access-user').focus();};});
      document.querySelectorAll('[data-access-remove]').forEach(function(b){b.onclick=function(){ask({title:'Remove this member from the whitelist?',message:'They lose their master-server access the next time permissions apply.',confirmLabel:'Remove',destructive:true}).then(function(ok){if(!ok)return;run(async function(){var r=assert(await call('/api/master/whitelist',{user_id:b.dataset.accessRemove},'DELETE'));state.entries=r.entries;state.review=null;state.action={id:r.action_id,status:'queued'};state.message='Member removed.';});});};});
      var action=$('access-action');if(action)action.onclick=function(){run(async function(){state.action=assert(await call('/api/master/action?id='+encodeURIComponent(state.action.id))).action;var r=assert(await call('/api/master/config'));Object.assign(cfg(),r);});};
    }
    function enter(tab) {
      if(!(cfg().built||{}).lockdown)return;
      if(tab==='lockdown'&&state.entries===null)run(async function(){state.entries=assert(await call('/api/master/whitelist')).entries;});
      if(tab==='audit'&&state.events===null)run(function(){return refreshEvents(false);});
    }
    return {lockdown:lockdown,audit:audit,bind:bind,enter:enter};
  }
  root.MasterAccess={create:create,parseTargets:parseTargets,escape:esc};
  if(typeof module!=='undefined')module.exports=root.MasterAccess;
})(typeof window!=='undefined'?window:globalThis);
