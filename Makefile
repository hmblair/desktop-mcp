.PHONY: build test install uninstall clean

build: node_modules
	npm run build -w packages/shared
	npm run build -w packages/firefox
	npm run build -w packages/thunderbird
	cd packages/firefox && make xpi
	cd packages/thunderbird && make dist/thunderbird-mcp.xpi

test:
	npm run test -w packages/firefox
	npm run test -w packages/thunderbird

install:
	cd packages/firefox && make install
	cd packages/thunderbird && make install

uninstall:
	cd packages/firefox && make uninstall
	cd packages/thunderbird && make uninstall

node_modules: package.json packages/*/package.json
	npm install

clean:
	cd packages/firefox && make clean
	cd packages/thunderbird && make clean
	rm -rf packages/shared/dist
