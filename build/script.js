
///////////////////
termOut('[SCRIPT LOADED]');

// #############  WEBP SUPPORT DEV  ############################################
const Webp2PngSWClient=(e,t)=>{let n=!t&&void 0,r=null;const s=[],o=[];new Promise(e=>{if(t)return e(!1);const n=sessionStorage.getItem("webp2png_native");if(n)return e("true"===n);const r=new Image;r.onload=()=>e(r.width>0&&r.height>0),r.onerror=()=>e(!1),r.src="data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="}).then(e=>{let t;for(n=e,sessionStorage.setItem("webp2png_native",e?"true":"false");t=o.shift();)t(e)});const a=()=>void 0!==n?Promise.resolve(n):new Promise(e=>o.push(e)),c=()=>{r&&r.postMessage({cmd:"webp2png-clientDisconnect"})};return(async()=>{if(await a()||"object"==typeof self.Webp2Png)return Promise.resolve();return e?new Promise((t,n)=>{const r=document.createElement("script");r.src=e,r.onload=()=>{(()=>{let e;for(;e=s.shift();)e.res()})(),t()},r.onerror=e=>{((e,t)=>{let n;for(;n=s.shift();)n.rej(t)})(),n(e)},document.body.appendChild(r)}):(c(),Promise.reject("Webp2Png API undefined"))})().catch(e=>console.error(e)),{isWebpReady:a,applySWUrl:async e=>{e.startsWith("/")&&(e=location.origin+e);const t=new URL(e);return await a()?t.searchParams.delete("webp2png"):t.searchParams.set("webp2png","true"),t.href},serviceWorkerHandler:async(e,t)=>{if(r=e,await a())return;if(t)return c(),void document.location.reload();const n=new MessageChannel;n.port1.onmessage=async t=>{const n=t.data;if(n.cmd)switch(n.cmd){case"webp2png-convert":try{n.data=await(e=>"object"==typeof self.Webp2Png?self.Webp2Png.toArrayBuffer(e):new Promise((t,n)=>{s.push({res:async()=>{"object"!=typeof self.Webp2Png&&n("Webp2Png not loaded");try{t(await self.Webp2Png.toArrayBuffer(e))}catch(e){n(e)}},rej:n})}))(n.data),n.cmd="webp2png-response",e.postMessage(n)}catch(t){n.error=!0,delete n.data,e.postMessage(n),console.error(t)}}},window.addEventListener("beforeunload",c),e.postMessage({cmd:"webp2png-clientConnect"},[n.port2])},disconnectSW:c}};
// #############  WEBP SUPPORT DEV  ############################################

const FORCE_WEBP2PNG = true;
const DISABLE_CACHE = false;
const DISABLE_CONCURRENCY = true;
const N_LOOP = 20;

const withoutServiceWorker = async () => {
	console.log('WITHOUT SERVICE WORKER');
	termOut('[WEBP2PNG WITHOUT SERVICE WORKER]');

	try {
		const regs = await navigator.serviceWorker.getRegistrations();
		regs.forEach(x => x.unregister()
			.catch(err => console.warn(err))
			.finally(() => document.location.reload())
		);
	} catch (err) {
		termOut('[SERVICE WORKER UNREGISTER ERROR]'+err.message);
	}

	await new Promise((res, rej) => {
		const script = document.createElement('script');
		script.src = 'webp2png/webp2png-api.min.js';
		script.onload = res;
		script.onerror = rej;
		document.body.appendChild(script);
	});

	let i = 0;
	const test = async (webpUrl) => {
		try {
			const im = new Image();
			document.body.appendChild(im);
			//termOut('FETCH START');
			const res = await fetch(webpUrl);
			if (res.ok) {
				//termOut('FETCH OK');
				const ts = performance.now();

				const buffer = await res.arrayBuffer();
				//*
				// noinspection JSUnresolvedVariable
				const blob = await Webp2Png.toBlob(buffer);
				const imageUrl = URL.createObjectURL(blob);
				/*/

				const imageUrl = await Webp2Png.toBase64Url(buffer);
				//*/
				im.onload = () => {
					//URL.revokeObjectURL(imageUrl);
					console.log('WITHOUT SW - time loaded',++i,webpUrl,
						'imageUrl',(performance.now() - ts)+'ms');
				};
				im.src = imageUrl;
			}
		} catch (err) {
			console.warn(err);
		///////////////////
		termOut('[ERROR]'+err.message);
		}
	};

	for (let i = 0; i < N_LOOP; i++) {
		test('image.webp').then();
		test('image2.webp').then();
		test('image3.webp').then();
		test('image4.webp').then();
	}

};

const withServiceWorker = async () => {
	console.log('WITH SERVICE WORKER');
		///////////////////
		termOut('[WEBP2PNG WITH SERVICE WORKER]');
	(async () => {
		if (!('serviceWorker' in navigator)) return;

// ###########################  WEBP SUPPORT START  ############################
		const w2pSWC = Webp2PngSWClient('webp2png/webp2png-api.min.js',FORCE_WEBP2PNG);
// ############################  WEBP SUPPORT END  #############################

		try {
			const swURL = new URL(location.origin
				+(location.pathname + '/service-worker.js').replace(/\/{2,}/,'/'));

			swURL.searchParams.append('nocache',DISABLE_CACHE.toString());
			swURL.searchParams.append('no-concurrency',DISABLE_CONCURRENCY.toString());

// ###########################  WEBP SUPPORT START  ############################
			const wReg = await navigator.serviceWorker.register(
				await w2pSWC.applySWUrl(swURL.href)
			);
			const isInstall = !!wReg.installing;
// ############################  WEBP SUPPORT END  #############################

			const serviceWorker =
				wReg.active ? wReg.active :
				wReg.waiting ? wReg.waiting :
				wReg.installing ? wReg.installing : null;

			serviceWorker.addEventListener('error',err => {
				///////////////////
				termOut('[ERROR]'+err.message);
				console.error(err);
			});

// ###########################  WEBP SUPPORT START  ############################
			await navigator.serviceWorker.ready;
			w2pSWC.serviceWorkerHandler(serviceWorker,isInstall).then();
// ############################  WEBP SUPPORT END  #############################


	/*
			navigator.serviceWorker.addEventListener('message',e =>
				termOut('[################## WEBP2PNG '
					+'RECEIVE FROM SERVICE WORKER #################] '+e.data));

			///////////////////
			termOut('[WEBP2PNG SEND MESSAGE TO SW]');
			serviceWorker.postMessage('test');
	//*/
			self.SWClearCache = () => {
				serviceWorker.postMessage({cmd:'clearCache'});
			};
		} catch (err) {
			console.error(err);
			///////////////////
			termOut('[ERROR]'+err.message);
		}
	})();
	try {
		//setTimeout(() => {
			let i = 0;
			const test = async (webpUrl) => {
				const ts = performance.now();
				const im = new Image();
				im.onload = () => {
					console.log('WITH SW - time loaded',++i,webpUrl,
						(performance.now() - ts)+'ms');
				};
				im.src = webpUrl;
				document.body.appendChild(im);
			};

			for (let i = 0; i < N_LOOP; i++) {
				test('image.webp?t='+i).then();
				test('image2.webp?t='+i).then();
				test('image3.webp?t='+i).then();
				test('image4.webp?t='+i).then();
				test('image5.webp?t='+i).then();
			}

		//},300);

	} catch (err) {
		console.error(err);
		///////////////////
		termOut('[ERROR]'+err.message);
	}
};

if (location.search.includes('no-sw')) withoutServiceWorker().then();
else withServiceWorker().then();