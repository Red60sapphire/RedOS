/* global Filer, LocalFS, AFSShell, idbKeyval, mime */
// Due to red's filesystem only being available once an red instance is running,
// we need a temporary filesystem to store files that are requested for caching.
// As the red filesystem is a wrapper around Filer, we can use default Filer here.
importScripts("/libs/filer/filer.min.js");
importScripts("/lib/api/filesystem/Filesystem.js");
importScripts("/lib/api/filesystem/LocalFS.js");

self.Buffer = Filer.Buffer;
const filerfs = new Filer.FileSystem({
	name: "red-mainContext",
	provider: new Filer.FileSystem.providers.IndexedDB(),
});
const filersh = new filerfs.Shell();

let opfs = undefined;
let opfssh = undefined;

const bootStrapFSReady = new Promise((res, rej) => {
	console.log(globalThis);
	globalThis.idbKeyval
		.get("bootFromOPFS")
		.then(async (res) => {
			if (res) {
				opfs = await LocalFS.newRootOPFS();
				globalThis.red = { fs: opfs }; // Stupid thing for AFSShell compat
				opfssh = new AFSShell();
			}
			res(true);
		})
		.catch((e) => {
			res(true);
		});
});

async function currentFs() {
	await bootStrapFSReady;
	// isConnected will return true if the red instance is running, and otherwise infinitely wait.
	// it will never return false, but it may hang indefinitely if the red instance is not running.
	// here, we race the isConnected promise with a timeout to prevent hanging indefinitely.

	if (!self.isConnected) {
		// An red instance has not been started yet to populate the isConnected promise.
		// We automatically know that the filesystem is not connected.
		return {
			fs: opfs || filerfs,
			sh: opfssh || filersh,
		};
	}

	const CONN_TIMEOUT = 1000;
	const winner = await Promise.race([
		new Promise((resolve) =>
			setTimeout(() => {
				resolve({
					fs: opfs || filerfs,
					sh: opfssh || filersh,
					fallback: true,
				});
			}, CONN_TIMEOUT),
		),
		self.isConnected.then(() => ({
			fs: self.redfs,
			sh: self.redsh,
		})),
	]);

	if (winner.fallback) {
		console.debug("Falling back to Filer");
		// unset isConnected so that we don't hold up future requests
		self.isConnected = undefined;
	}

	return winner;
}
