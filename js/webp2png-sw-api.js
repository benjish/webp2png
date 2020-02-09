
const Webp2PngSW = (() => {
	const CLIENT_TIMEOUT = 15000;
	const isWebpResponse = res => res.headers
		.get('content-type') === 'image/webp';

	if ((new URL(location.href)).searchParams.get('webp2png') !== 'true') {
		return {
			fetchHandler : res => Promise.resolve(res),
			messageHandler: () => false,
			isWebpResponse,
		};
	}

	let webpClient = null;
	let clientPromises = [];
	const requestStore = {};

	const getID = (() => {
		const idG = (function *() {
			let index = 1;
			while (true)
				yield index++;
		})();
		return () => 'ID'+idG.next().value;
	})();

	const waitClient = () => webpClient ? Promise.resolve(webpClient) :
	new Promise((res,rej) => {
		let exec = false;
		let tim;

		const lock = () => {
			if (exec) return false;
			exec = true;
			clearTimeout(tim);
			return true;
		};

		const fnRes = cl => lock() && res(cl);
		const fnRej = () => lock() && rej();

		tim = setTimeout(fnRej,CLIENT_TIMEOUT);

		clientPromises.push({res:fnRes,rej:fnRej});
	});

	const converter = response => new Promise(async (res,rej) => {
		const id = getID();
		try {
			const data = await response.arrayBuffer();

			requestStore[id] = {res,rej};

			const client = await waitClient();
			if (!client) { // noinspection ExceptionCaughtLocallyJS
				throw new Error('NO CLIENT');
			}
			client.postMessage({cmd:'webp2png-convert',id,data});

		} catch (err) {
			delete requestStore[id];
			rej(err);
		}
	});

	const fetchHandler = async (res) => {
		if (!res.ok || !isWebpResponse(res)) return res;

		return await converter(res);
	};

	const messageHandler = e => {
		if (typeof e.data != 'object' || !e.data.cmd) return false;
		const data = e.data;
		switch (e.data.cmd) {
			case 'webp2png-response': {
				if (data.id in requestStore) {
					const fn = requestStore[data.id];
					if (!fn) console.warn('WEBP CALLBACK RESPONSE LOST');
					else if (data.error) fn.rej(data.error);
					else fn.res(new Response(data.data.buffer,
						{headers:{'Content-Type':data.data.type}})
					);
					delete requestStore[data.id];
				}
				return true;
			}
			case 'webp2png-clientConnect': {
				webpClient = e.ports[0];
				let p;
				while ((p = clientPromises.shift())) p.res(webpClient);
				return true;
			}
			case 'webp2png-clientDisconnect': {
				webpClient = null;
				let p;
				while ((p = clientPromises.shift())) p.rej();
				return true;
			}
		}

		return false;
	};

	return {fetchHandler:fetchHandler,messageHandler:messageHandler,isWebpResponse};
})();
