/* Request pooling helpers for tipdash (P2b).
 * - mapLimit: run an async fn over items with at most `limit` in flight, results in input order.
 * - createDedupe: share one in-flight promise per key; each caller gets its own view (e.g. Response.clone()).
 * - singleFlight: skip a new call while the previous one is still running (returns the running promise).
 * Plain browser global (window.ReqPool) + CommonJS export for node --test.
 */
(function(root){
  function mapLimit(items, limit, fn){
    var list=Array.prototype.slice.call(items||[]);
    var n=Math.max(1, Math.floor(Number(limit)||1));
    var out=new Array(list.length), next=0;
    function worker(){
      if(next>=list.length) return Promise.resolve();
      var i=next++;
      return Promise.resolve().then(function(){ return fn(list[i], i); })
        .then(function(v){ out[i]=v; return worker(); });
    }
    var runners=[];
    for(var k=0;k<Math.min(n, list.length);k++) runners.push(worker());
    return Promise.all(runners).then(function(){ return out; });
  }
  function createDedupe(){
    var inflight=new Map();
    function run(key, start, view){
      var p=inflight.get(key);
      if(!p){
        p=Promise.resolve().then(start);
        inflight.set(key, p);
        var clear=function(){ if(inflight.get(key)===p) inflight.delete(key); };
        p.then(clear, clear);
      }
      return view ? p.then(view) : p;
    }
    return { run: run, size: function(){ return inflight.size; } };
  }
  function singleFlight(fn){
    var running=null;
    function wrapped(){
      if(running) return running;
      var args=arguments, self=this;
      running=Promise.resolve().then(function(){ return fn.apply(self, args); });
      var done=function(){ running=null; };
      running.then(done, done);
      return running;
    }
    wrapped.busy=function(){ return !!running; };
    return wrapped;
  }
  // At most `limit` fns in flight. Later callers wait. A rejection frees the slot.
  function createGate(limit){
    var n=Math.max(1, Math.floor(Number(limit)||1));
    var active=0, q=[];
    function pump(){
      while(active<n && q.length){
        var job=q.shift();
        active++;
        Promise.resolve().then(job.start).then(job.ok, job.bad).then(function(){
          active--;
          pump();
        }, function(){
          active--;
          pump();
        });
      }
    }
    function run(fn){
      return new Promise(function(ok, bad){
        q.push({start:fn, ok:ok, bad:bad});
        pump();
      });
    }
    run.active=function(){ return active; };
    run.queued=function(){ return q.length; };
    run.limit=n;
    return run;
  }
  // Cached / non-DB routes. These must not sit behind the dash-db queue.
  function dbSlotExempt(path){
    var p=String(path||"").split("?")[0];
    if(p==="/api/fixtures" || p.indexOf("/api/fixtures/")===0) return true;
    if(p==="/api/upcoming") return true;
    if(p==="/api/odds" || p.indexOf("/api/odds/")===0) return true;
    return false;
  }
  // run(path, fn): DB paths share one gate (default 2); exempt paths run immediately.
  function createApiQueue(limit){
    var gate=createGate(limit==null?2:limit);
    function run(path, fn){
      if(dbSlotExempt(path)) return Promise.resolve().then(fn);
      return gate(fn);
    }
    run.gate=gate;
    return run;
  }
  // Random 0–1000 ms. rand is 0..1 (1 means a full second).
  function jitterMs(rand){
    var r=rand==null?Math.random():Number(rand);
    if(!Number.isFinite(r) || r<0) r=0;
    if(r>1) r=1;
    return Math.round(r*1000);
  }
  // 503 wait: same backoff as api(), then retry_after (seconds) when the body has it,
  // plus a random 0–1 s so retries from one page don't land together.
  function retryWaitMs(opts){
    opts=opts||{};
    var attempt=Math.max(1, Number(opts.attempt)||1);
    var waitMs=1500*Math.pow(2, attempt-1);
    var body=opts.body;
    if(body && body.retry_after!=null){
      var ra=Number(body.retry_after);
      if(Number.isFinite(ra) && ra>=0) waitMs=(ra>0 && ra<120)?(ra*1000):ra;
    }
    waitMs=Math.min(Math.max(waitMs, 400), 15000);
    var code=body && body.error ? String(body.error) : "";
    var busy=opts.status===503 || code==="db_busy" || code==="warming";
    if(busy) waitMs+=jitterMs(opts.rand);
    return waitMs;
  }
  function retriesStillPending(opts){
    opts=opts||{};
    if(opts.phase==="retry") return true;
    if(opts.maxAttempts!=null && opts.attempt!=null && Number(opts.attempt)<Number(opts.maxAttempts)) return true;
    return false;
  }
  // Blank while a 503/network retry is still queued. The failure line is only for a finished try.
  function unreachableText(opts){
    opts=opts||{};
    if(retriesStillPending(opts)) return "";
    if(opts.network || opts.status===0 || opts.status===502 || opts.status===503) return "Couldn't reach the bot";
    return "";
  }
  // Delay until the next grid slot (period, phase offset) plus 0–1 s jitter.
  // Scheduling again from the previous fire stays on that grid (jitter does not accumulate).
  function pollDelay(nowMs, periodMs, offsetMs, rand){
    var now=Number(nowMs);
    if(!Number.isFinite(now) || now<0) now=0;
    var period=Math.floor(Number(periodMs));
    if(!Number.isFinite(period) || period<1) period=1;
    var offset=Math.floor(Number(offsetMs)||0)%period;
    if(offset<0) offset+=period;
    var mod=now%period;
    var grid=now-mod+offset;
    if(grid<=now) grid+=period;
    return (grid-now)+jitterMs(rand);
  }
  // Scheduled tips every 30s on the minute-grid; live tips every 90s, 15s later,
  // so the two never fire in the same second.
  var POLLS={
    scheduled:{period:30000, offset:0},
    liveTips:{period:90000, offset:15000}
  };
  var api={ mapLimit: mapLimit, createDedupe: createDedupe, singleFlight: singleFlight,
    createGate: createGate, dbSlotExempt: dbSlotExempt, createApiQueue: createApiQueue,
    jitterMs: jitterMs, retryWaitMs: retryWaitMs, retriesStillPending: retriesStillPending,
    unreachableText: unreachableText, pollDelay: pollDelay, POLLS: POLLS };
  root.ReqPool=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
