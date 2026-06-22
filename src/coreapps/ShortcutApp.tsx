interface RedShortcut {
	name: string;
	command: string;
	icon?: string;
	console?: boolean;
}

// mangle file path to a valid package id component
function b26(s: string) {
	return [...s]
		.map((c) =>
			[...c.charCodeAt(0).toString(26)]
				.map((d) => String.fromCharCode(parseInt(d, 36) + 97))
				.join(""),
		)
		.join("");
}

// Virtual app that represents a shortcut, used when a shortcut file is placed in the apps directory
class ShortcutApp extends App implements RedShortcut {
	static async launchShortcut(props: RedShortcut) {
		// Manually parse the cmdline string. Eventually we should have a proper
		// system shell that can handle this, but for now we will just use a regex
		// to split the command line into arguments.
		const cmdline = (props.command!.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(
			(arg) => {
				// Remove surrounding quotes if they exist
				if (arg.startsWith('"') && arg.endsWith('"')) {
					return arg.slice(1, -1);
				}
				return arg;
			},
		);

		const streams = red.logger.createStreams(
			"Shortcut: " + props.name + " (" + props.command + ") ",
		);

		if (props.console) {
			const terminal = red.settings.get("terminal") || "red.ashell";
			red.settings.set("terminal", terminal);

			const proc = await red.apps[terminal].open([
				"--cmd",
				cmdline.join(" "),
			]);
			if (proc instanceof WMWindow || proc instanceof Process) {
				proc.stdout.pipeTo(streams.stdout);
				proc.stderr.pipeTo(streams.stderr);
			}
			return proc;
		} else {
			red.processes.execute(cmdline[0]!, cmdline.slice(1)).then((proc) => {
				proc.stdout.pipeTo(streams.stdout);
				proc.stderr.pipeTo(streams.stderr);
			});
		}
	}

	name = "Shortcut";
	package = "red.shortcut";
	icon = "/assets/icons/generic.svg";
	console = false;
	command =
		'/usr/bin/vista.ajs --alert --message "Red Shortcuts: This shortcut is not configured properly." --title Error';

	constructor(filePath: string, props: RedShortcut) {
		super();
		Object.assign(this, props);
		this.package = "red.shortcut." + b26(filePath);
		if (red.apps[this.package]) {
			if (red.apps[this.package] instanceof ShortcutApp) {
				// If the app is already a shortcut app, just return it
				return red.apps[this.package];
			}

			this.package += "." + Date.now();
			console.warn(
				"ShortcutApp: Mitigating package collision, please investigate as this is a bug.",
			);
			red.notifications.add({
				title: "ShortcutApp",
				description:
					"Package collision detected, renaming package, please investigate or report this.",
				timeout: 10000,
			});
		}
	}

	async open() {
		await ShortcutApp.launchShortcut(this);
	}
}
