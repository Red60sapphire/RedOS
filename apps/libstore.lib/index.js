const fflate = await red.import("npm:fflate");

const fs = red.fs;
const Buffer = Filer.Buffer;

function unzip(zip) {
	return new Promise((res, rej) => {
		fflate.unzip(zip, (err, unzipped) => {
			if (err) rej(err);
			else res(unzipped);
		});
	});
}

export class Store {
	client;
	cache;
	hooks;

	constructor(client, hooks) {
		this.client = client;
		this.cache = {};
		this.hooks = hooks || {
			onError: (appName, error) => {
				console.error(error);
			},
			onDownloadStart: (appName, packageId) => {
				console.log(`Download started for ${appName} (${packageId})`);
			},
			onDepInstallStart: (appName, libName) => {
				console.log("Dependency install started");
			},
			onComplete: (appName) => {
				console.log("Download complete");
			},
		};
	}

	refresh(repos = []) {
		if (repos.length === 0) {
			this.cache = {};
			return;
		}
		repos.forEach((repo) => {
			this.cache[repo] = null;
		});
	}

	async getRepo(url, name) {
		if (this.cache[url]) {
			return this.cache[url];
		}

		let repo = new StoreRepo(this.client, this.hooks, url, name);
		let manifestVersion = await repo.getRepoManifest();
		repo.version = manifestVersion;
		if (manifestVersion === "legacy") {
			repo = new StoreRepoLegacy(this.client, this.hooks, url, name);
		}
		await repo.refreshRepoCache();
		this.cache[url] = repo;
		return repo;
	}
}

function rebrandApp(app) {
	if (app.name) app.name = app.name.replace(/[Aa]nura/g, "Red");
	if (app.desc) app.desc = app.desc.replace(/[Aa]nura/g, "Red");
	if (app.summary) app.summary = app.summary.replace(/[Aa]nura/g, "Red");
	return app;
}

const textExtensions = new Set([
	".html", ".js", ".mjs", ".json", ".css", ".svg", ".txt", ".md",
	".ts", ".tsx", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg",
]);

function rebrandFile(buffer, filepath) {
	const ext = filepath.substring(filepath.lastIndexOf(".")).toLowerCase();
	if (!textExtensions.has(ext)) return buffer;
	try {
		let text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
		const replaced = text.replace(/[Aa]nura/g, "Red");
		if (replaced === text) return buffer;
		return new TextEncoder().encode(replaced);
	} catch {
		return buffer;
	}
}

export class StoreRepo {
	baseUrl;
	name;
	client;
	hooks;
	repoCache;
	manifest;
	version;
	thumbCache = { apps: {}, libs: {} };

	directories = red.settings.get("directories");

	constructor(client, hooks, baseUrl, name) {
		this.client = client;
		this.hooks = hooks;
		this.baseUrl = baseUrl;
		this.name = name;
	}

	setHook(name, fn) {
		this.hooks[name] = fn;
	}

	async refreshRepoCache() {
		try {
			let response = await this.client.fetch(this.baseUrl + "list.json");
			if (!response.ok) {
				throw new Error(
					`Failed to fetch repo list (HTTP ${response.status})`,
				);
			}
			let list = await response.json();
			let repoCache = {};
			for (const category in list) {
				repoCache[`${category}`] = [];
				await Promise.all(
					list[category].map(async (app) => {
						app.baseUrl = this.baseUrl + category + "/" + app.package + "/";
						app.repo = this.baseUrl;
						rebrandApp(app);
						repoCache[`${category}`].push(app);
					}),
				);
			}

			this.repoCache = repoCache;
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	async getRepoManifest() {
		let response = await this.client.fetch(
			this.baseUrl + "manifest.json",
		);
		if (response.ok) {
			this.manifest = await response.json();
			return this.manifest.version;
		} else {
			console.warn(
				`Repo manifest not found at ${this.baseUrl}manifest.json (HTTP ${response.status}), falling back to legacy mode`,
			);
			return "legacy";
		}
	}

	refreshThumbCache() {
		this.thumbCache = { apps: {}, libs: {} };
	}

	async getAppThumb(appName) {
		if (this.thumbCache.apps[appName]) {
			return this.thumbCache.apps[appName];
		}
		const app = await this.getApp(appName);
		if (!app) {
			throw new Error("App not found");
		}
		let thumb = URL.createObjectURL(
			await (await this.client.fetch(encodeURI(app.baseUrl + app.icon))).blob(),
		);
		this.thumbCache.apps[appName] = thumb;
		return thumb;
	}

	async getLibThumb(libName) {
		if (this.thumbCache.libs[libName]) {
			return this.thumbCache.libs[libName];
		}
		const lib = await this.getLib(libName);
		if (!lib) {
			throw new Error("Lib not found");
		}
		let thumb = URL.createObjectURL(
			await (await this.client.fetch(encodeURI(lib.baseUrl + lib.icon))).blob(),
		);
		this.thumbCache.libs[libName] = thumb;
		return thumb;
	}

	async getApps() {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.apps || [];
	}

	async getApp(appName) {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		let app = this.repoCache.apps.find((app) => app.package === appName);
		return app;
	}

	async getLibs() {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.libs || [];
	}

	async getLib(libName) {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		let lib = this.repoCache.libs.find((lib) => lib.package === libName);
		return lib;
	}

	async installApp(appName) {
		const app = await this.getApp(appName);
		if (!app) {
			throw new Error("App not found");
		}
		this.hooks.onDownloadStart(app.name, app.package);

		if (app.dependencies) {
			for (const lib of app.dependencies) {
				let hasDep =
					Object.keys(red.libs).filter((x) => red.libs[x].package === lib)
						.length > 0;
				if (hasDep) continue;
				this.hooks.onDepInstallStart(app.name, lib);
				await this.installLib(lib);
			}
		}

		const zipFile = new Uint8Array(
			await (
				await this.client.fetch(encodeURI(app.baseUrl + app.data))
			).arrayBuffer(),
		);
		let zip = await unzip(zipFile);

		const path = `${this.directories["apps"]}/${appName}.app`;

		await new Promise((resolve) =>
			new fs.Shell().mkdirp(path, function () {
				resolve();
			}),
		);

		let installHook = null;
		if (app.InstallHook) {
			const installHookText = await (
				await this.client.fetch(app.baseUrl + app.installHook)
			).text();
			installHook = installHookText;
		}

		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await fs.promises.mkdir(`${path}/${relativePath}`);
				} else {
					if (relativePath === "manifest.json") {
						let manifest = new TextDecoder().decode(content);
						manifest = JSON.parse(manifest);
						rebrandApp(manifest);
						manifest.marketplace = {};
						if (app.version) {
							manifest.marketplace.version = app.version;
						}
						manifest.marketplace.repo = app.repo;
						if (app.dependencies) {
							manifest.marketplace.dependencies = app.dependencies;
						}
						await fs.promises.writeFile(
							`${path}/${relativePath}`,
							JSON.stringify(manifest),
						);
						continue;
					}
					await fs.promises.writeFile(
						`${path}/${relativePath}`,
						await Buffer.from(rebrandFile(content, relativePath)),
					);
				}
			}
			await red.registerExternalApp("/fs" + path);
			if (installHook) window.top.eval(installHook);
			this.hooks.onComplete(app.name);
			return 200; // throw new Error is truthy so this is my solution
		} catch (error) {
			this.hooks.onError(app.name, error);
		}
	}

	async installLib(libName) {
		const lib = await this.getLib(libName);
		if (!lib) {
			throw new Error("Lib not found");
		}
		this.hooks.onDownloadStart(lib.name, lib.package);
		const zipFile = new Uint8Array(
			await (await this.client.fetch(lib.baseUrl + lib.data)).arrayBuffer(),
		);
		let zip = await unzip(zipFile);

		const path = `${this.directories["libs"]}/${libName}.lib`;

		await new Promise((resolve) =>
			new fs.Shell().mkdirp(path, function () {
				resolve();
			}),
		);

		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await fs.promises.mkdir(`${path}/${relativePath}`);
				} else {
					if (relativePath === "manifest.json") {
						let manifest = new TextDecoder().decode(content);
						manifest = JSON.parse(manifest);
						rebrandApp(manifest);
						manifest.marketplace = {};
						if (lib.version) {
							manifest.marketplace.version = lib.version;
						}
						manifest.marketplace.repo = lib.repo;
						if (lib.dependencies) {
							manifest.marketplace.dependencies = lib.dependencies;
						}
						fs.writeFile(`${path}/${relativePath}`, JSON.stringify(manifest));
						continue;
					}
					fs.writeFile(`${path}/${relativePath}`, await Buffer.from(rebrandFile(content, relativePath)));
				}
			}
			await sleep(500); // race condition because of manifest.json
			await red.registerExternalLib("/fs" + path);
			this.hooks.onComplete(lib.name);
			return 200;
		} catch (error) {
			this.hooks.onError(lib.name, error);
		}
	}
}

export class StoreRepoLegacy {
	baseUrl;
	name;
	client;
	hooks;
	repoCache;
	version;
	thumbCache = { apps: {}, libs: {} };

	directories = red.settings.get("directories");

	constructor(client, hooks, baseUrl, name) {
		this.client = client;
		this.hooks = hooks;
		this.baseUrl = baseUrl;
		this.name = name;
		this.version = "legacy";
	}

	setHook(name, fn) {
		this.hooks[name] = fn;
	}

	async refreshRepoCache() {
		let response = await this.client.fetch(this.baseUrl + "list.json");
		if (!response.ok) {
			throw new Error(
				`Failed to fetch repo list (HTTP ${response.status})`,
			);
		}
		this.repoCache = await response.json();
		for (const category in this.repoCache) {
			for (const app of this.repoCache[category]) {
				rebrandApp(app);
			}
		}
	}

	refreshThumbCache() {
		this.thumbCache = { apps: {}, libs: {} };
	}

	async getAppThumb(appName) {
		if (this.thumbCache.apps[appName]) {
			return this.thumbCache.apps[appName];
		}
		const app = await this.getApp(appName);
		if (!app) {
			throw new Error("App not found");
		}
		let thumb = URL.createObjectURL(
			await (
				await this.client.fetch(encodeURI(this.baseUrl + app.icon))
			).blob(),
		);
		this.thumbCache.apps[appName] = thumb;
		return thumb;
	}

	async getLibThumb(libName) {
		if (this.thumbCache.libs[libName]) {
			return this.thumbCache.libs[libName];
		}
		const lib = await this.getLib(libName);
		if (!lib) {
			throw new Error("Lib not found");
		}
		let thumb = URL.createObjectURL(
			await (
				await this.client.fetch(encodeURI(this.baseUrl + lib.icon))
			).blob(),
		);
		this.thumbCache.libs[libName] = thumb;
		return thumb;
	}

	async getApps() {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.apps || [];
	}

	async getApp(appName) {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.apps.find((app) => app.name === appName);
	}

	async getLibs() {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.libs || [];
	}

	async getLib(libName) {
		if (!this.repoCache) {
			await this.refreshRepoCache();
		}
		return this.repoCache.libs.find((lib) => lib.name === libName);
	}

	async installApp(appName) {
		const app = await this.getApp(appName);
		if (!app) {
			throw new Error("App not found");
		}
		this.hooks.onDownloadStart(appName, appName);

		if (app.dependencies) {
			for (const lib of app.dependencies) {
				let hasDep =
					Object.keys(red.libs).filter((x) => red.libs[x].name === lib)
						.length > 0;
				if (hasDep) continue;
				this.hooks.onDepInstallStart(appName, lib);
				await this.installLib(lib);
			}
		}

		const zipFile = new Uint8Array(
			await (
				await this.client.fetch(encodeURI(this.baseUrl + app.data))
			).arrayBuffer(),
		);
		let zip = await unzip(zipFile);

		const path = `${this.directories["apps"]}/${appName}.app`;

		await new Promise((resolve) =>
			new fs.Shell().mkdirp(path, function () {
				resolve();
			}),
		);

		let postInstallScript;

		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await fs.promises.mkdir(`${path}/${relativePath}`);
				} else {
					if (relativePath == "post_install.js") {
						let script = new TextDecoder().decode(rebrandFile(content, relativePath));
						postInstallScript = script;
						continue;
					}
					fs.writeFile(`${path}/${relativePath}`, await Buffer.from(rebrandFile(content, relativePath)));
				}
			}
			await sleep(500); // race condition because of manifest.json
			await red.registerExternalApp("/fs" + path);
			if (postInstallScript) window.top.eval(postInstallScript);
			this.hooks.onComplete(appName);
		} catch (error) {
			this.hooks.onError(appName, error);
		}
	}

	async installLib(libName) {
		const lib = await this.getLib(libName);
		if (!lib) {
			throw new Error("Lib not found");
		}
		this.hooks.onDownloadStart(libName, libName);
		const zipFile = new Uint8Array(
			await (
				await this.client.fetch(encodeURI(this.baseUrl + lib.data))
			).arrayBuffer(),
		);
		let zip = await unzip(zipFile);

		const path = `${this.directories["libs"]}/${libName}.lib`;

		await new Promise((resolve) =>
			new fs.Shell().mkdirp(path, function () {
				resolve();
			}),
		);

		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await fs.promises.mkdir(`${path}/${relativePath}`);
				} else {
					fs.writeFile(`${path}/${relativePath}`, await Buffer.from(rebrandFile(content, relativePath)));
				}
			}
			await sleep(500); // race condition because of manifest.json
			await red.registerExternalLib("/fs" + path);
			this.hooks.onComplete(libName);
		} catch (error) {
			this.hooks.onError(libName, error);
		}
	}
}
// Re-export fflate for convenience
export { fflate };
