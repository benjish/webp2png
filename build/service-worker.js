// #############  WEBP SUPPORT DEV  ############################################
const Webp2PngSW=(()=>{const e=e=>"image/webp"===e.headers.get("content-type");if("true"!==new URL(location.href).searchParams.get("webp2png"))return{fetchHandler:e=>Promise.resolve(e),messageHandler:()=>!1,isWebpResponse:e};let t=null,r=[];const n={},s=(()=>{const e=function*(){let e=1;for(;;)yield e++}();return()=>"ID"+e.next().value})(),a=e=>new Promise(async(a,o)=>{const c=s();try{const s=await e.arrayBuffer();n[c]={res:a,rej:o};const i=await(()=>t?Promise.resolve(t):new Promise((e,t)=>{let n,s=!1;const a=()=>!s&&(s=!0,clearTimeout(n),!0),o=()=>a()&&t();n=setTimeout(o,15e3),r.push({res:t=>a()&&e(t),rej:o})}))();if(!i)throw new Error("NO CLIENT");i.postMessage({cmd:"webp2png-convert",id:c,data:s})}catch(e){delete n[c],o(e)}});return{fetchHandler:async t=>t.ok&&e(t)?await a(t):t,messageHandler:e=>{if("object"!=typeof e.data||!e.data.cmd)return!1;const s=e.data;switch(e.data.cmd){case"webp2png-response":if(s.id in n){const e=n[s.id];e?s.error?e.rej(s.error):e.res(new Response(s.data.buffer,{headers:{"Content-Type":s.data.type}})):console.warn("WEBP CALLBACK RESPONSE LOST"),delete n[s.id]}return!0;case"webp2png-clientConnect":{let n;for(t=e.ports[0];n=r.shift();)n.res(t);return!0}case"webp2png-clientDisconnect":{let e;for(t=null;e=r.shift();)e.rej();return!0}}return!1},isWebpResponse:e}})();
// #############  WEBP SUPPORT DEV  ############################################

let DISABLE_CACHE = false;
let DISABLE_CONCURRENCY = false;

const testParam = (params,name,defV) => {
	const v = params.get(name);
	if (!v) return defV;
	return v !== 'false';
};

// noinspection DuplicatedCode
const swParams = (new URL(location.href)).searchParams;
DISABLE_CACHE = testParam(swParams,'nocache',DISABLE_CACHE);
DISABLE_CONCURRENCY = testParam(swParams,'no-concurrency',DISABLE_CONCURRENCY);

console.log('DISABLE_CACHE',!!DISABLE_CACHE,'DISABLE_CONCURRENCY',!!DISABLE_CONCURRENCY);

const CACHE_VERSION = 'v1';
let getCache = () => caches.open(CACHE_VERSION);

// noinspection SpellCheckingInspection
const OFFLINE_CONTENT = '<!DOCTYPE html><html lang="fr"><head><meta charset="ut'
	+ 'f-8"><meta name="viewport" content="width=device-width, initial-scale=1,'
	+ ' shrink-to-fit=no"><title>Hors Ligne</title><style>*{box-sizing:border-b'
	+ 'ox;margin:0;padding:0;}html,body{margin:0;padding:0;min-height:0;min-wid'
	+ 'th:320px;height:100%;width:100%;position:relative;background-color:#222;'
	+ '}div,body{display:flex;align-items:center;justify-content:center;}div{bo'
	+ 'rder-radius:50%;height:280px;width:280px;background-color:#080808;box-sh'
	+ 'adow:0 0 10px -10px #444;transition:box-shadow 0.4s;cursor:pointer;}'
	+ 'div:hover{box-shadow:0 0 10px 7px #444;}h1{font-family:sans-serif;co'
	+ 'lor:#ccc;}</style></head><body ononline="location.reload()" ><div onclic'
	+ 'k="location.reload()"><h1>Hors Ligne</h1></div></body></html>';

const catchResponse = err => {
	console.warn('[Service Worker]',err);

	const res = new Response(OFFLINE_CONTENT);
	res.headers.set('Content-Type','text/html; charset=UTF-8');
	res.headers.set('Cache-Control','no-cache');

	return res;
};

const fetchCache = async req => {
	const rReq = req.clone ? req.clone() : req;

// ############  WEBP SUPPORT START  ###########################################
	const resO = await fetch(rReq);
	const isWebp = Webp2PngSW.isWebpResponse(resO);
	const res = await Webp2PngSW.fetchHandler(resO);
// #############  WEBP SUPPORT END  ############################################

	if (!DISABLE_CACHE) {
		if (!isWebp) return res;
		const reqCache = res.clone();
		getCache().then(cache => cache.put(req.url.replace(/\?.*$/,''),reqCache))
	}

	return res;

};

const cacheMatch = async req => {
	const cache = await getCache();
	const res = await cache.match(req.url.replace(/\?.*$/,''));

	if (DISABLE_CACHE || res === undefined) throw new Error('NOT IN CACHE');

	return res;
};

const cacheOrFetch = async req => {
	try {
		return await cacheMatch(req);
	} catch (errC) {
		try {
			return await fetchCache(req);
		} catch (errF) {
			return catchResponse(errF);
		}
	}
};

let pendingReq = {};

const concurrentRequestReq = async (url, req, strategy) => {
	url = url.replace(/\?.*$/,'');
	const responseAll = (type,res) => {
		if (pendingReq[url]) {
			const pend = pendingReq[url];
			for (let i = 0; i < pend.length; i++) {
				pend[i][type](i+1 < pend.length && res.clone ?
					res.clone() : res);
			}
			delete pendingReq[url];
		}
	};

	try {
		const r = await strategy.call(null,req);
		responseAll(0,r);
	} catch (err) {
		responseAll(1,err);
	}
};

const concurrentRequest = (url, req, strategy) => {
	url = url.replace(/\?.*$/,'');
	const exist = !!pendingReq[url];
	if (!exist) pendingReq[url] = [];

	const pReq = new Promise((res,rej) => {
		pendingReq[url].push([res,rej]);
	});

	if (!exist) concurrentRequestReq(url,req,strategy).then();

	return pReq;
};

self.onupdatefound = () => self.skipWaiting();

self.onerror = err => console.error('SW ERROR',err);

self.onfetch = e => {
	const req = e.request;
	e.respondWith(DISABLE_CONCURRENCY ? cacheOrFetch(req) :
		concurrentRequest(req.url,req,cacheOrFetch));
};

self.onmessage = e => {
	try {
// ############  WEBP SUPPORT START  ###########################################
		if (Webp2PngSW.messageHandler(e)) return;
// #############  WEBP SUPPORT END  ############################################

		const data = e.data;

		if (data === 'test') {
			console.log('[SW] MESSAGE RECEIVE FROM MAIN SCRIPT');
			// noinspection JSCheckFunctionSignatures
			return e.source.postMessage('test');
		}


		if (!data.cmd) return;
		// noinspection JSRedundantSwitchStatement
		switch (data.cmd) {
			case 'clearCache' :
				caches.delete(CACHE_VERSION).then();
				break;
		}
	} catch (err) {
		console.error('[SW ONMESSAGE]',err);
	}
};