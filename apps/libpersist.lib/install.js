export default function install(red) {
	const directories = red.settings.get("directories");

	red.fs.exists(directories["opt"] + "/red.persistence", async (exists) => {
		if (exists) return;
		await red.fs.promises.mkdir(directories["opt"] + "/red.persistence");
		await red.fs.promises.mkdir(
			directories["opt"] + "/red.persistence/providers",
		);
		await red.fs.promises.mkdir(
			directories["opt"] + "/red.persistence/providers/anureg",
		);

		await red.fs.promises.writeFile(
			directories["opt"] + "/red.persistence/providers/anureg/manifest.json",
			JSON.stringify({
				name: "anureg",
				vendor: "[[internal]]",
				description:
					"Red's default persistance provider, using a simple JSON file",
				handler: "index.js",
			}),
		);

		await red.fs.promises.writeFile(
			directories["opt"] + "/red.persistence/providers/anureg/index.js",
			`const { PersistenceProvider } = await red.import("red.persistence");
export default class Anureg extends PersistenceProvider {
    cache = {};
    fs;
    basepath;
    file;
    config;

    constructor(red, config, fs, basepath) {
        super(red);
        this.fs = fs;
        this.basepath = basepath;
        this.config = config;
        this.file = config.path || (this.basepath + (config.filename || "/settings.json"));
    }

    async init() {
        this.fs.exists(this.basepath, async (exists) => {
            if (!exists) {
                await this.fs.promises.mkdir(this.basepath);
            }
        });
        try {
            const text = await this.fs.promises.readFile(this.file);
            this.cache = JSON.parse(text);
        }
        catch (e) {
            this.fs.writeFile(this.file, JSON.stringify(this.cache));
        }
    }

    async get(prop) {
        return this.cache[prop];
    }

    async has(prop) {
        return prop in this.cache;
    }

    async set(prop, val) {
        this.cache[prop] = val;
        return new Promise((r) => this.fs.writeFile(this.file, JSON.stringify(this.cache), r));
    }

    createStoreFn(stateful, win) {
        return async (
            target,
            ident,
            _backing
        ) => {
            target = (await this.get("dreamland." + ident)) || target;

            win.addEventListener("close", () => {
                console.info("[dreamland.js]: saving " + ident);
                this.set("dreamland." + ident, target);
            });
            
            return stateful(target);
        }
    }
}
export const using = ["fs", "basepath"];
export const lifecycle = ["init"];`,
		);
	});
}
