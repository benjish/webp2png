
#ifndef IM_WEBP2PNG
#define IM_WEBP2PNG

#define PNG_DEBUG 0
#define PNG_COMPRESSION_LEVEL 1
#define PNG_ALLOC_UNIT 500000

#define JPEG_QUALITY 90

#include <stdlib.h>
#include <string.h>
#include <png.h>

#include "webp/decode.h"
#include "b64/cencode.h"
#include "jpegturbo/jpeglib.h"

typedef struct {
	uint8_t* raw;
	int width;
	int height;
	size_t size;
} imRaw_t;

typedef struct {
  uint8_t* buffer;
  size_t size;
  size_t bsize;
} imBuffer_t;

char* b64Encode(const char* input, const unsigned long size);

int readWebp(uint8_t* data, size_t dataSize,imRaw_t* p_out,int* p_alpha);

void pngWriteBufferData(png_structp png_ptr, png_bytep data, png_size_t length);

int raw2PNG(imRaw_t* in,imBuffer_t* p_out);

int raw2JPEG(imRaw_t* in,imBuffer_t* p_out);

int webp2png(uint8_t* inWebp, size_t sizeWebp, uint8_t** p_outBuffer, size_t* p_outSize, uint32_t* p_outType);

int webp2png64(uint8_t* inWebp, size_t sizeWebp, char** p_base64, size_t* p_sizeBase64, uint32_t* p_outType);

#endif /* IM_WEBP2PNG */