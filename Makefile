.PHONY : clear-cache, clean, mrproper
.SUFFIXES :

PATHS = "C/webp2png.c" "C/im.c" "C/b64/cencode.c" "C/webp/libwebpdecoder.bc" "C/jpegturbo/libjpeg.a"
OUT = -o build/webp2png/webp2png-worker.js
EXTRA = -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -s EXPORTED_FUNCTIONS='["_malloc","_free","_webp2pngExport"]'
OPT = -O2 --llvm-lto 3 -s WASM=1 -s NO_EXIT_RUNTIME=1 -s FETCH=0 -s STRICT=1 -s MINIMAL_RUNTIME=0 -s EMIT_EMSCRIPTEN_METADATA
JS_OPT =  -s ENVIRONMENT=worker -s DYNAMIC_EXECUTION=0  #-s 'EXPORT_NAME="Webp2PngWorker"'-s EXPORT_ES6=1 -s MODULARIZE=1
LINK = -s USE_LIBPNG # --post-js "js/post-js.js" --js-library "js/library.js"-s RESERVED_FUNCTION_POINTERS=0
MEMORY = -s ALLOW_MEMORY_GROWTH=1
DEV = -s ASSERTIONS=2 -s DEMANGLE_SUPPORT=1 -s STACK_OVERFLOW_CHECK=2 -s SAFE_HEAP=1
DEBUG = -O0 -g -g4 --tracing --profiling

all : compile move

compile : makedir
	emcc $(OPT) $(JS_OPT) $(MEMORY) $(EXTRA) $(LINK) $(OUT) $(PATHS)
	$(MAKE) import

debug : makedir
	emcc $(OPT) $(JS_OPT) $(MEMORY) $(EXTRA) $(LINK) $(DEBUG) $(DEV) $(OUT) $(PATHS)
	# cp -R ./C ./build/C
	$(MAKE) import-debug
	$(MAKE) move

test : makedir
	emcc $(EXTRA) $(LINK) $(OUT) $(PATHS)
	$(MAKE) import

move : makedir
	cp template/* build/
	cp template/.htaccess build/
	cp js/webp2png-api.js build/webp2png/
	$(MAKE) template-replace

makedir:
	[ -d build/webp2png ] || mkdir build/webp2png

import : api-terser
	terser -mc -- js/post-js.js >> build/webp2png/webp2png-worker.js
	# cat js/post-js.js >> build/webp2png/webp2png-worker.js

api-terser :
	terser -mc -- js/webp2png-api.js > build/webp2png/webp2png-api.min.js
	terser -mc -- js/webp2png-sw-api.js > build/webp2png/webp2png-sw-api.min.js
	terser -mc -- js/webp2png-swc-api.js > build/webp2png/webp2png-swc-api.min.js

import-debug :
	cat js/post-js.js >> build/webp2png/webp2png-worker.js
	cat js/webp2png-api.js > build/webp2png/webp2png-api.min.js
	cat js/webp2png-sw-api.js > build/webp2png/webp2png-sw-api.min.js
	cat js/webp2png-swc-api.js > build/webp2png/webp2png-swc-api.min.js

template-replace :
	sed -i -e '/\/\/ %WEBP2PNG_SW%/{r build/webp2png/webp2png-sw-api.min.js' -e 'd}' build/service-worker.js
	sed -i -e '/\/\/ %WEBP2PNG_SWC%/{r build/webp2png/webp2png-swc-api.min.js' -e 'd}' build/script.js

clear-cache :
	emcc --clear-cache

clean :
	rm -R build/*

mrproper : clean clear-cache
