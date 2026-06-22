/**
 * Export helpful global objects from the red top level window
 */
class RedGlobalsLib extends Lib {
	icon = "/assets/icons/generic.svg";
	package = "red.globalscope";
	name = "Red Global Objects";
	latestVersion = red.version.pretty;

	versions = {
		[red.version.pretty]: {
			/**
			 * Run a top level eval to get a global object,
			 * this is how you would get an object from the top level
			 * before this library was created but this helper method
			 * is more verbose and easier to explain.
			 */
			getWithPath: eval.bind(top),
		},
	};

	constructor() {
		super();

		this.versions[red.version.pretty] = new Proxy<any>(
			this.versions[red.version.pretty],
			{
				get: (target, prop) => {
					if (prop in target) {
						return target[prop];
					} else {
						try {
							return this.versions[red.version.pretty]?.getWithPath(prop);
						} catch (_) {
							return undefined;
						}
					}
				},
			},
		);
	}

	async getImport(version: string): Promise<any> {
		if (!version) version = this.latestVersion;
		if (!this.versions[version]) {
			throw new Error("Version not found");
		}
		return this.versions[version];
	}
}
