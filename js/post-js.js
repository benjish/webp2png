
(() => {
let RUNTIME_INITIALIZED = false;
const QUEUE = [];

// noinspection JSUnresolvedVariable
const CModule = Module;

const C_webp2png = CModule.cwrap('webp2pngExport',"number",
	["number","number","number","number","number","number"]);

const declareVoidPTR = () => {
	const uint32 = new Uint32Array(1);
	const ptr = CModule._malloc(uint32.BYTES_PER_ELEMENT);
	CModule.HEAPU8.set(uint32, ptr);

	return ptr;
};

const writeBufferToHeap = (buffer) => {
	const uint8 = new Uint8Array(buffer);
	const p_uint8 = CModule._malloc(uint8.length * uint8.BYTES_PER_ELEMENT);
	CModule.HEAPU8.set(uint8, p_uint8);

	return {ptr:p_uint8,size:uint8.length};
};

const converterWasm = (bufferWebp,is64) => {
	//const ts = performance.now();

	const bufWebp = writeBufferToHeap(bufferWebp);
	const p_outBuf  = declareVoidPTR();
	const p_outSize = declareVoidPTR();
	const p_outType = declareVoidPTR();

	const CReturn = C_webp2png(is64 ? 1 : 0,
			bufWebp.ptr,bufWebp.size,p_outBuf,p_outSize,p_outType);

	//console.log('C_webp2png RES',performance.now() - ts);

	CModule._free(bufWebp);

	if (CReturn) {
		CModule._free(p_outBuf);
		CModule._free(p_outSize);
		CModule._free(p_outType);
		return null;
	}

	const outRaw  = CModule.HEAPU32[p_outBuf / 4];
	const outSize = CModule.HEAPU32[p_outSize / 4];
	const type    = CModule.HEAPU32[p_outType / 4];

	CModule._free(p_outBuf);
	CModule._free(p_outSize);
	CModule._free(p_outType);

	const ui8 = new Uint8Array(
		CModule.HEAPU8.subarray(outRaw,outRaw + outSize));

	CModule._free(outRaw);

	return {ui8,type: type ? 'image/png' : 'image/jpeg'};
};

const getBuffer = im => {
	if (!im) throw new Error('webp2png EMPTY DATA');
	else if (im.constructor.name === 'ArrayBuffer') return Promise.resolve(im);
	else if (im.buffer) return Promise.resolve(im.buffer);
	else if (im.arrayBuffer) {
		const buffer = im.arrayBuffer();
		return buffer.constructor.name === 'Promise' ? buffer : Promise.resolve(buffer);
	}
	else throw new Error('webp2png UNEXPECTED BUFFER FORMAT');
};

const formatOutput = (raw,format) => {
	switch (format) {
		case 'blob' : return new Blob([raw.ui8], {type: raw.type});
		case 'buffer' : return {buffer:raw.ui8.buffer,type:raw.type};
		case 'url64' : return 'data:'+raw.type+';base64,' + new TextDecoder().decode(raw.ui8);
		default:
			throw new Error('BAD OUTPUT FORMAT '+format);
	}
};

const convertWebp2Png = async (data,format) => {
	const buffer = await getBuffer(data);
	let raw;

	try {
		raw = converterWasm(buffer, format === 'url64');
	} catch (err) {
		console.error('[WEB2PNG WORKER WASM ERROR]',err.message);
		console.error(err);
		// noinspection JSCheckFunctionSignatures
		self.postMessage({cmd:'worker-error',error:err});
		throw new Error("WASM ERROR");
	}

	if (!raw) throw new Error("CONVERSION ERROR");

	return formatOutput(raw,format);
};

const messConvert = async (data) => {
	try {
		const im = await convertWebp2Png(data.data,data.format);
		// noinspection JSCheckFunctionSignatures
		self.postMessage({cmd:data.cmd,id:data.id,data:im,error:0});
	} catch (err) {
		// noinspection JSCheckFunctionSignatures
		self.postMessage({cmd:data.cmd,id:data.id,error:err});
	}
};

self.addEventListener('message',e => {
	const data = e.data;

	// noinspection JSRedundantSwitchStatement
	switch (data.cmd) {
		case 'convert' :
			return RUNTIME_INITIALIZED ? messConvert(data) : QUEUE.push(data);
	}

});

self.addEventListener('error',err => {
	console.error('[WEB2PNG WORKER ERROR]',err.message);
	console.error(err);
	// noinspection JSCheckFunctionSignatures
	self.postMessage({cmd:'worker-error',error:err});
});

self.addEventListener('messageerror',err => {
	console.error('[WEB2PNG WORKER MESSAGE ERROR]',err.message);
	console.error(err);
	// noinspection JSCheckFunctionSignatures
	self.postMessage({cmd:'worker-message-error',error:err});
});


// noinspection JSUnresolvedFunction
addOnPostRun(() => {
	RUNTIME_INITIALIZED = true;
	let item;
	while ((item = QUEUE.shift())) {
		messConvert(item).then();
	}
});

})();