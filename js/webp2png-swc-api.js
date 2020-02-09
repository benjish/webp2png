
// noinspection SpellCheckingInspection
/**
*	autoLoadWebp2Png : url de la lib webp2png qui sera chargée
					uniquement si la conversion est activée
*/
const Webp2PngSWClient = (autoLoadWebp2Png,forceConversion) => {
	let webpSupport = forceConversion ? false : undefined;
	let p_serviceWorker = null;

	const convertQueue = [];
	const supportQueue = [];
	(new Promise(res => {
		if (forceConversion) return res(false);

		const savedTest = sessionStorage.getItem("webp2png_native");
		if (savedTest) return res(savedTest === 'true');

		const img = new Image();
		img.onload = () => res(img.width > 0 && img.height > 0);
		img.onerror = () => res(false);
		// noinspection SpellCheckingInspection
		img.src = 'data:image/webp;base64,'
			+'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
	})).then(x => {
		webpSupport = x;
		sessionStorage.setItem("webp2png_native",x ? 'true' : 'false');
		let qe;
		while((qe = supportQueue.shift())) qe(x);
	});

	const isWebpReady = () => {
		if (webpSupport !== undefined) return Promise.resolve(webpSupport);
		return new Promise(res => supportQueue.push(res));
	};

	const convert = data => {
		if (typeof self.Webp2Png == 'object') return self.Webp2Png.toArrayBuffer(data);

		return new Promise((res,rej) => {
			const c = async () => {
				if (typeof self.Webp2Png != 'object') rej('Webp2Png not loaded');
				try {
					res(await self.Webp2Png.toArrayBuffer(data));
				} catch (err) { rej(err); }
			};

			convertQueue.push({res:c,rej});
		});
	};

	const disconnectSW = () => {
		if (p_serviceWorker) {
			p_serviceWorker.postMessage({cmd:'webp2png-clientDisconnect'});
		}
	};

	const serviceWorkerHandler = async (serviceWorker,isInstall) => {
		p_serviceWorker = serviceWorker;

		if (await isWebpReady()) return;

		if (isInstall) {
			disconnectSW();
			document.location.reload();
			return;
		}

		const messageChannel = new MessageChannel();
		messageChannel.port1.onmessage = async (e) => {
			const data = e.data;
			if (!data.cmd) return;

			// noinspection JSRedundantSwitchStatement
			switch (data.cmd) {
				case 'webp2png-convert': {
					try {
						data.data = await convert(data.data);
						data.cmd = 'webp2png-response';
						serviceWorker.postMessage(data);
					} catch (err) {
						data.error = true;
						delete data.data;
						serviceWorker.postMessage(data);
						console.error(err);
					}
					break;
				}
			}
		};

		window.addEventListener('beforeunload',disconnectSW);

		serviceWorker.postMessage({cmd: 'webp2png-clientConnect'}
			,[messageChannel.port2]);
	};

	const applySWUrl = async (serviceWorkerUrl) => {
		if (serviceWorkerUrl.startsWith('/')) {
			serviceWorkerUrl = location.origin + serviceWorkerUrl;
		}

		const url = new URL(serviceWorkerUrl);

		if (!await isWebpReady()) url.searchParams.set('webp2png','true');
		else url.searchParams.delete('webp2png');

		return url.href;
	};

	const autoloadScript = async () => {
		if (await isWebpReady() || typeof self.Webp2Png === 'object') {
			return Promise.resolve();
		}

		const resolveQueue = () => {
			let qe;
			while((qe = convertQueue.shift())) qe.res();
		};

		const rejectQueue = (rej,err) => {
			let qe;
			while((qe = convertQueue.shift())) qe.rej(err);
		};

		if (!autoLoadWebp2Png) {
			disconnectSW();
			return Promise.reject("Webp2Png API undefined");
		}

		return new Promise((res, rej) => {
			const script = document.createElement('script');
			script.src = autoLoadWebp2Png;
			script.onload = () => {
				resolveQueue();
				res();
			};
			script.onerror = err => {
				rejectQueue();
				rej(err);
			};
			document.body.appendChild(script);
		});
	};

	autoloadScript().catch(err => console.error(err));

	// noinspection JSValidateTypes
	return {isWebpReady,applySWUrl,serviceWorkerHandler,disconnectSW};
};
