
///////////////////
termOut('[SCRIPT LOADED]');

// #############  WEBP SUPPORT DEV  ############################################
// %WEBP2PNG_SWC%
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