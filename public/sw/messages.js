/* global Comlink, LocalFS, AFSShell, idbKeyval */

var cacheenabled;

const callbacks = {};
const filepickerCallbacks = {};

addEventListener("message", async (event) => {
	if (event.data.red_target === "red.x86.proxy") {
		let callback = callbacks[event.data.id];
		callback(event.data.value);
	}
	if (event.data.red_target === "red.cache") {
		cacheenabled = event.data.value;
		idbKeyval.set("cacheenabled", event.data.value);
	}
	if (event.data.red_target === "red.bootFromOPFS") {
		if (event.data.value) {
			opfs = await LocalFS.newRootOPFS();
			globalThis.red = { fs: opfs }; // Stupid thing for AFSShell compat
			opfssh = new AFSShell();
		} else {
			opfs = undefined;
			opfssh = undefined;
		}
	}
	if (event.data.red_target === "red.filepicker.result") {
		let callback = filepickerCallbacks[event.data.id];
		callback(event.data.value);
	}
	if (event.data.red_target === "red.comlink.init") {
		self.swShared = Comlink.wrap(event.data.value);
		swShared.test.then(console.log);
		self.isConnected = swShared.test;
	}
	if (event.data.red_target === "red.nohost.set") {
		self.redfs = swShared.red.fs;
		self.redsh = swShared.sh;
	}
});
