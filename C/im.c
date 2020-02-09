#include "im.h"

char* b64Encode(const char* input, const unsigned long size) {
	/* set up a destination buffer large enough to hold the encoded data */
	size_t maxsize = (size / 3 + 1) * 4 + 1;
	char* output = (char*)malloc(sizeof(char) * maxsize);
	/* keep track of our encoded position */
	char* c = output;
	/* store the number of bytes encoded by a single call */
	int cnt = 0;
	/* we need an encoder state */
	base64_encodestate s;

	/*---------- START ENCODING ----------*/
	/* initialise the encoder state */
	base64_init_encodestate(&s);

	/* gather data from the input and send it to the output */
	cnt = base64_encode_block(input, size, c, &s);
	c += cnt;

	/* since we have encoded the entire input string, we know that
	   there is no more input data; finalise the encoding */
	cnt = base64_encode_blockend(c, &s);
	c += cnt;

	/*---------- STOP ENCODING  ----------*/

	/* we want to print the encoded data, so null-terminate it: */
	*c = 0;

	return output;
}

int readWebp(uint8_t* data, size_t dataSize,imRaw_t* p_out,int* p_alpha) {
	WebPBitstreamFeatures features;

	int w,h;
	uint8_t* raw;

	if (WebPGetFeatures(data,dataSize,&features) != VP8_STATUS_OK) {
		return EXIT_FAILURE;
	}

	*p_alpha = features.has_alpha;

	raw = WebPDecodeRGBA(data,dataSize,&w,&h);

	if (raw == NULL) return EXIT_FAILURE;

	p_out->raw = raw;
	p_out->width = w;
	p_out->height = h;
	p_out->size = h*w*4;

	return EXIT_SUCCESS;
}

void pngWriteBufferData(png_structp p_png, png_bytep data, png_size_t length) {
	imBuffer_t* p=(imBuffer_t*)png_get_io_ptr(p_png);
	size_t nsize = p->size + length;

	if (!p->buffer) {
		p->bsize = nsize + PNG_ALLOC_UNIT;
		p->buffer = malloc(p->bsize);

	} else if(nsize > p->bsize) {
		p->bsize = nsize + PNG_ALLOC_UNIT;
		p->buffer = realloc(p->buffer, p->bsize);
	}

	if(!p->buffer) png_error(p_png, "Write Error");

	memcpy(p->buffer + p->size, data, length);
	p->size += length;
}

int raw2PNG(imRaw_t* in,imBuffer_t* p_out) {
	png_structp p_png = NULL;
	png_infop p_info = NULL;
	uint8_t** rows = NULL;
	uint8_t* dataRGBA = in->raw;
	int w = in->width;
	int h = in->height;

	p_out->buffer = NULL;
	p_out->size   = 0;
	p_out->bsize  = 0;

	p_png = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);

	if (!p_png) {
		fprintf(stderr, "[write_png_file] png_create_write_struct failed\n");
		return EXIT_FAILURE;
	}

	p_info = png_create_info_struct(p_png);
	if (!p_info) {
		png_destroy_write_struct(&p_png,(png_infopp)NULL);

		fprintf(stderr, "[read_png_file] png_create_info_struct failed\n");
		return EXIT_FAILURE;
	}

	rows = (uint8_t**) malloc(sizeof(uint8_t*) * h);
	if (setjmp(png_jmpbuf(p_png))) {
		png_destroy_write_struct(&p_png, &p_info);
		free(rows);

		if (p_out->buffer) free(p_out->buffer);

		fprintf(stderr, "[write_png_file] Error during writing bytes\n");
		return EXIT_FAILURE;
	}

	png_set_filter(p_png, PNG_FILTER_TYPE_BASE,PNG_FILTER_NONE);
	png_set_compression_level(p_png, PNG_COMPRESSION_LEVEL);

	png_set_IHDR(p_png, p_info, w, h, 8,
		PNG_COLOR_TYPE_RGBA,
		PNG_INTERLACE_NONE,
		PNG_COMPRESSION_TYPE_DEFAULT,
		PNG_FILTER_TYPE_DEFAULT);

	for (size_t y = 0; y < h; ++y)
		rows[y] = (uint8_t*)dataRGBA + y * w * 4;

	png_set_rows(p_png, p_info, rows);

	png_set_write_fn(p_png, p_out, pngWriteBufferData, NULL);
	png_write_png(p_png, p_info, PNG_TRANSFORM_IDENTITY, NULL);
	png_write_end(p_png, p_info);
	png_destroy_write_struct(&p_png, &p_info);

	free(rows);

	if (p_out->size < p_out->bsize) {
		p_out->buffer = realloc(p_out->buffer, p_out->size);
		p_out->bsize  = p_out->size;
	}

	return EXIT_SUCCESS;
}

int raw2JPEG(imRaw_t* in,imBuffer_t* p_out) {
	struct jpeg_compress_struct cinfo;
	struct jpeg_error_mgr jerr;
	JSAMPROW row_pointer[1];
	int row_stride;
	uint8_t* dataRGBA = in->raw;
	uint8_t* outBuffer = NULL;
	size_t outSize = 0;
	int w = in->width;
	int h = in->height;

	cinfo.err = jpeg_std_error(&jerr);
	jpeg_create_compress(&cinfo);

	jpeg_mem_dest(&cinfo,&outBuffer,&outSize);

	cinfo.image_width = w;      /* image width and height, in pixels */
	cinfo.image_height = h;
	cinfo.input_components = 4;           /* # of color components per pixel */
	cinfo.in_color_space = JCS_EXT_RGBX;
	row_stride = w * 4;

	jpeg_set_defaults(&cinfo);
	jpeg_set_quality(&cinfo, JPEG_QUALITY,
									TRUE /* limit to baseline-JPEG values */);

	jpeg_start_compress(&cinfo, TRUE);

	while (cinfo.next_scanline < cinfo.image_height) {
		row_pointer[0] = &dataRGBA[cinfo.next_scanline * row_stride];
		jpeg_write_scanlines(&cinfo, row_pointer, 1);
	}

	jpeg_finish_compress(&cinfo);
	jpeg_destroy_compress(&cinfo);

	p_out->buffer = malloc(outSize);
	p_out->size = outSize;

	memcpy(p_out->buffer, outBuffer, outSize);
	free(outBuffer);

	return EXIT_SUCCESS;
}

int webp2png(uint8_t* inWebp, size_t sizeWebp, uint8_t** p_outBuffer,
									size_t* p_outSize, uint32_t* p_outType) {
	imRaw_t imr;
	imBuffer_t outRaw;
	int rV,alpha;

	*p_outBuffer = NULL;

	if (readWebp(inWebp,sizeWebp,&imr,&alpha) == EXIT_FAILURE) {
		return EXIT_FAILURE;
	}

	*p_outType = (uint32_t)alpha;

	rV = alpha ? raw2PNG(&imr,&outRaw) : raw2JPEG(&imr,&outRaw);
	WebPFree(imr.raw);

	if (rV == EXIT_FAILURE) return EXIT_FAILURE;

	*p_outBuffer  = outRaw.buffer;
	*p_outSize = outRaw.size;

	return EXIT_SUCCESS;
}

int webp2png64(uint8_t* inWebp, size_t sizeWebp, char** p_base64,
									size_t* p_sizeBase64, uint32_t* p_outType) {
	uint8_t* outBuffer;
	size_t outSize;
	*p_base64 = NULL;
	int rV;

	rV = webp2png(inWebp,sizeWebp,&outBuffer,&outSize,p_outType);
	if (rV == EXIT_SUCCESS) {
		*p_base64 = b64Encode((char*)outBuffer,outSize);
		*p_sizeBase64 = strlen(*p_base64);
	}

	free(outBuffer);

	return rV;
}
