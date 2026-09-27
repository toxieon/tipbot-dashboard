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
  var api={ mapLimit: mapLimit, createDedupe: createDedupe, singleFlight: singleFlight };
  root.ReqPool=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
