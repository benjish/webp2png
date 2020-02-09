#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

//#include <emscripten.h>
//#include <emscripten/emscripten.h>
#include "im.h"

#ifdef __cplusplus
extern "C" {
#endif

/*
void DISPST(char* NAME,void* VAR) {
	uint8_t* da = (uint8_t*)VAR;
	printf("---------  TEST  -------\n%s : ",NAME);
	for (int u = 0; u < 10;u++) {
		printf("%d ",da[u]);
	}
	printf("\n--------------------\n");
}
*/

int //EMSCRIPTEN_KEEPALIVE
webp2pngExport(int32_t is64, uint8_t* inWebp, size_t sizeWebp,
	uint8_t** p_outBuf, size_t* p_outSize, uint32_t* p_outType) {

	return is64 ?
		webp2png64(inWebp,sizeWebp,(char**)p_outBuf,p_outSize,p_outType) :
		webp2png(inWebp,sizeWebp,p_outBuf,p_outSize,p_outType);
}

#ifdef __cplusplus
}
#endif
