
self.Webp2Png = (() => {
	const API_VERSION = '1.0.0';
	const STATE_FREE = 1;
	const STATE_BUSY = 2;

	let MAX_THREAD = 4;
	let WORKER_URL = (() => {
		const url = document.currentScript.src;
		return url.substring(0, url.lastIndexOf("/")+1) + 'webp2png-worker.js';
	})();
	let WORKER_TIMEOUT = 3000;

	const setMaxThread = nb => {
		MAX_THREAD = !nb ? (navigator.hardwareConcurrency || 4) : nb;
	};

	setMaxThread();

	const workerStore = {};
	let workerCounter = 0;

	const taskQueue = [];

	const getUniqID = (() => {
		const idGenerator = (function *() {
			let index = 1;
			while(true)
				yield index++;
		})();
		return () => idGenerator.next().value;
	})();

	const convertStore = (() => {
		const store = {};

		const add = fnc => {
			const id = getUniqID();
			store['ID'+id] = fnc;
			return id;
		};

		const getRm = id => {
			const rid = 'ID'+id;
			if (!(rid in store)) return null;

			const data = store[rid];
			delete store[rid];

			return data;
		};

		const remove = id => {
			const rid = 'ID'+id;
			if (rid in store) delete store[rid];
		};

		const clear = () => {
			for (const e in store) delete store[e];
		};

		return {add,getRm,remove,clear};
	})();

	const checkDataFormat = data => {
		if (!data) throw new Error('webp2png EMPTY DATA');
		if (data.constructor.name === 'ArrayBuffer'
			|| data.buffer
			|| typeof data.arrayBuffer == 'function'
		) return data;

		throw new Error('webp2png UNEXPECTED DATA FORMAT');
	};

	const createWorker = () => {
		if (workerCounter >= MAX_THREAD) return null;

		const workerID = 'ID'+getUniqID();
		let workerState, workerTime,workerCloseTimeout;

		const worker = new Worker(WORKER_URL);

		const terminate = () => {
			workerCounter--;
			worker.terminate();
			if (workerID in workerStore) delete workerStore[workerID];
		};

		const getState = () => workerState;
		const setState = (state) => {
			workerState = state;
			workerTime = performance.now();
			if (state === STATE_FREE) {
				workerCloseTimeout = setTimeout(terminate,WORKER_TIMEOUT);
			} else {
				clearTimeout(workerCloseTimeout);
			}
		};

		setState(STATE_FREE);

		const sendConvert = () => {
			const data = taskQueue.shift();
			if (!data) return false;
			setState(STATE_BUSY);
			worker.postMessage(data);

			return true;
		};

		const workerObject = {
			id:workerID,worker,getState,terminate,sendConvert
		};

		worker.onmessage = e => {
			const data = e.data;

			switch (data.cmd) {
				case 'convert' : {
					const fn = convertStore.getRm(data.id);
					if (!fn) console.warn('CALLBACK RESPONSE LOST');
					else if (data.error) fn.rej(data.error);
					else fn.res(data.data);

					if (!sendConvert()) setState(STATE_FREE);
					break;
				}

				case 'worker-error' :
				case 'worker-message-error' : {
					console.warn(data.cmd);
					console.warn(data.error);
					break;
				}
			}
		};

		worker.onerror = e => {
			console.error('[WEBP2PNG WORKER ERROR]');
			console.error(e);
			terminate();
		};

		worker.onmessageerror = e => {
			console.error('[WEBP2PNG WORKER MESSAGE ERROR]');
			console.error(e);
			terminate();
		};

		workerCounter++;
		workerStore['ID'+workerID] = workerObject;
		return workerObject;
	};

	const selectWorker = () => {
		for (const workerID in workerStore) {
			const worker = workerStore[workerID];
			if (worker.getState() === STATE_FREE) return worker;
		}
		return createWorker();
	};

	const convert = (data,format) => new Promise((res,rej) => {
		const id = convertStore.add({res,rej});
		try {
			data = checkDataFormat(data);
			taskQueue.push({cmd:'convert',id,data,format});
			const worker = selectWorker();
			if (worker) worker.sendConvert();
		} catch (err) {
			convertStore.remove(id);
			rej(err);
		}
	});

	const destroy = () => {
		for (const worker in workerStore) {
			workerStore[worker].terminate();
		}
	};

	// noinspection JSUnusedGlobalSymbols
	return {
		setMaxThread: nbThread => setMaxThread(nbThread),
		setWorkerUrl: url => WORKER_URL = url,
		setWorkerTimeout: timeout => WORKER_TIMEOUT = timeout,
		destroy: () => destroy(),
		version: () => API_VERSION,

		toBlob:        im => convert(im,'blob'),
		toArrayBuffer: im => convert(im,'buffer'),
		toBase64Url:   im => convert(im,'url64'),
	};
})();
