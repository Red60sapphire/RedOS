const channel = new BroadcastChannel("tab");

// send message to all tabs, after a new tab
channel.postMessage("newtab");
let activetab = true;
let splashToRemove: HTMLElement | null = null;
channel.addEventListener("message", (msg) => {
	if (msg.data === "newtab" && activetab) {
		// if there's a previously registered tab that can read the message, tell the other tab to kill itself
		channel.postMessage("blackmanthunderstorm");
	}

	if (msg.data === "blackmanthunderstorm") {
		activetab = false;
		//@ts-ignore
		for (const elm of [...document.children]) {
			elm.remove();
		}
		document.open();
		document.write(
			`
            <html>
            <head>
            <style>
            body {
                font-family: "Roboto", RobotoDraft, "Droid Sans", Arial, Helvetica, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
                text-align: center;
                background: black;
                color: white;
                overflow: none;
                margin: 0;
            }
            #wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            </style>
            </head>
            <body>
            <div id="wrapper">
            <h1>RedOS is already running in another tab</h1>
            <p>Please close the other tab and reload.</p>
            </div>
            </body>
            </html>
            `,
		);
		document.close();
	}
});

const clickoffCheckerState = $state({
	active: false,
});

const clickoffChecker = (
	<div
		class={[
			use(clickoffCheckerState.active, (active) =>
				active
					? css`
							position: absolute;
							width: 100%;
							height: 100%;
							display: block;
							z-index: 9998;
						`
					: css`
							display: none;
						`,
			),
		]}
	/>
);

const updateClickoffChecker = (show: boolean) => {
	clickoffCheckerState.active = show;
};

let taskbar: Taskbar;
let launcher: Launcher;
let oobeview: OobeView;
let quickSettings: QuickSettings;
let calendar: Calendar;
const alttab = new AltTabView();

let red: Red;
// global

window.addEventListener("load", async () => {
	const swShared: any = {
		test: true,
	};

	(window as any).swShared = swShared;

	const comlinksrc = "/libs/comlink/comlink.min.mjs";
	const comlink = await import(comlinksrc);

	let conf, milestone, commit;
	let bootStrapFs = Filer.fs;

	if (await (window as any).idbKeyval.get("bootFromOPFS")) {
		bootStrapFs = (await LocalFS.newRootOPFS()) as any;
	}
	try {
		conf = await (await fetch("/config.json")).json();
		milestone = await (await fetch("/MILESTONE")).text();
		commit = await (await fetch("/COMMIT")).text();

		console.debug("writing config??");
		await bootStrapFs.promises.writeFile(
			"/config_cached.json",
			JSON.stringify(conf),
		);
	} catch (e) {
		conf = JSON.parse(
			new TextDecoder().decode(
				await bootStrapFs.promises.readFile("/config_cached.json"),
			),
		);
	}

	red = await Red.new(conf);
	(window as any).anura = red;
	if (bootStrapFs instanceof LocalFS) {
		red.settings.cache["bootFromOPFS"] = true;
	} else {
		red.settings.cache["bootFromOPFS"] = false;
		LocalFS.newOPFS("/opfs"); // mount opfs on boot
	}

	if (red.platform.type !== "desktop") {
		splashToRemove = bootsplashMobile;
		document.body.appendChild(bootsplashMobile);
	} else {
		if (red.settings.get("i-am-a-true-gangsta")) {
			splashToRemove = gangstaBootsplash;
			document.body.appendChild(gangstaBootsplash);
		} else {
			splashToRemove = bootsplash;
			document.body.appendChild(bootsplash);
		}
	}

	console.log(splashToRemove);

	swShared.red = red;
	swShared.sh = new red.fs.Shell();
	async function initComlink() {
		const { port1, port2 } = new MessageChannel();

		const msg = {
			red_target: "red.comlink.init",
			value: port2,
		};

		comlink.expose(swShared, port1);

		navigator.serviceWorker.controller!.postMessage(msg, [port2]);
		if (swShared.red)
			navigator.serviceWorker.controller!.postMessage({
				red_target: "red.nohost.set",
			});
	}

	navigator.serviceWorker.addEventListener("controllerchange", initComlink);

	await navigator.serviceWorker.register("/red-sw.js");
	initComlink();

	navigator.serviceWorker.addEventListener("message", (event) => {
		if (event.data.red_target === "red.sw.reinit") initComlink(); // this could accidentally be run twice but realistically there aren't any consequences for doing so
	});

	// Create "Process" that controls the service worker

	const swProcess = new SWProcess();
	// We do not want the service worker process to be garbage collected
	// so we will store it in the Window object as well.
	red.sw = swProcess;
	red.processes.register(swProcess);

	if (milestone) {
		const isValidUUID = (uuid: string) =>
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
				uuid,
			);
		if (isValidUUID(milestone.split("\n")[0]!)) {
			const stored = red.settings.get("milestone");
			if (!stored) {
				await red.settings.set("milestone", milestone);
			} else if (stored !== milestone) {
				await red.settings.set("milestone", milestone);
				if (red.settings.get("use-sw-cache")) {
					const tracker = document.getElementById("systemstatus")!;
					const tracker_br = document.getElementById("systemstatus-br")!;
					tracker.style.display = "unset";
					tracker_br.style.display = "unset";
					tracker.innerText = "Red is updating your system...";
					try {
						await new red.fs.Shell().promises.rm("/red_files", {
							recursive: true,
						});
					} catch {
						console.debug("cache already invalidated");
					}
					await preloadFiles(tracker);
				}
				console.debug("invalidated cache");
				window.location.reload();
			}
		} else {
			// Domain is either expired or some non conformant milestone is being delivered (bad extension?)
			// Either way, ignore and dont try and perform an update
			console.log("Red update poisoning detected...");
		}
	}
	const isGitRev = (hash: string) => /^[0-9a-f]{7,40}$/i.test(hash);
	if (commit) {
		if (isGitRev(commit.split("\n")[0]!)) {
			await red.settings.set("commit", commit);
		} else {
			console.warn("invalid commit hash from server, ignoring...");
		}
	}
	// Register requirements for redd
	red.registerLib(new ReddHelpersLib());

	// Register redd, claiming PID 1
	const redd = new Redd(1);

	red.redd = redd;
	red.processes.register(redd);
	ReddHelpers.setReady("red.redd");

	Object.entries(red)
		.filter(([_, v]) => v !== undefined)
		.map(([k]) => "red." + k)
		.forEach(ReddHelpers.setReady);

	/**
	 * These directories are used to load user apps and libs from
	 * the filesystem, along with folder shortcuts and other things.
	 */
	let directories = red.settings.get("directories");

	const defaultDirectories = {
		apps: "/usr/apps",
		libs: "/usr/lib",
		init: "/usr/init",
		bin: "/usr/bin",
		opt: "/opt",
	};

	const sh = new red.fs.Shell();

	/**
	 * This is a migration for the new directory structure
	 * introduced in RedOS 2.0.0. This is to ensure that
	 * users who have been using RedOS for a while can
	 * have a consistent experience with new installations.
	 */
	const map = {
		apps: ["/userApps", "/usr/apps"],
		libs: ["/userLibs", "/usr/lib"],
		init: ["/userInit", "/usr/init"],
	};

	if (directories) {
		const needsMigration = Object.entries(map).filter(
			([key, [old, _new]]) => directories[key] === old,
		);

		if (needsMigration.length > 0) {
			red.notifications.add({
				title: "Red Update",
				description:
					"RedOS has been updated to a new version. Users are recommended to change the installation directory of their apps and libraries to /usr/ to ensure consistency with new installations.",
				timeout: "never",
				buttons: [
					{
						text: "Migrate Now",
						callback: async () => {
							const migrate = async (oldPath: string, newPath: string) => {
								const parent = newPath.split("/").slice(0, -1);
								await sh.promises.mkdirp(parent.join("/"));
								await red.fs.promises.rename(oldPath, newPath);
							};

							await Promise.all(
								needsMigration.map(async ([key, [old, newPath]]) => {
									directories[key] = newPath;
									await migrate(old!, newPath!);
								}),
							);

							await red.settings.set("directories", directories);
						},
					},
				],
			});
		}
	} else {
		await red.settings.set("directories", (directories = defaultDirectories));
	}

	/**
	 * These directories are required for Red to function
	 * properly, and are automatically created if they
	 * don't exist.
	 *
	 * This is a setting so that it can be changed by applications
	 * that heavily modify the system. This will also be respected by
	 * the file manager and other system utilities to prevent the user
	 * from removing the shortcuts.
	 */
	let requiredDirectories = red.settings.get("requiredDirectories");

	if (!requiredDirectories || !requiredDirectories.includes("bin")) {
		await red.settings.set(
			"requiredDirectories",
			(requiredDirectories = ["apps", "libs", "init", "bin", "opt"]),
		);
	}

	requiredDirectories.forEach(async (k: string) => {
		if (!directories[k]) {
			directories[k] = defaultDirectories[k as keyof typeof defaultDirectories];
			await red.settings.set("directories", directories);
		}
		try {
			await sh.promises.mkdirp(directories[k]);
		} catch (e) {
			if (e.code !== "EEXIST") {
				console.error(e, " for ", directories[k]);
			}
		}
	});

	if ((await fetch("/fs/")).status !== 404) {
		try {
			const files = await red.fs.promises.readdir(directories["init"]);
			if (files) {
				for (const file of files) {
					// Init scripts have 2 modes:
					// 1. Normal init scripts, ran after all apps and libs are loaded
					// 2. redd init scripts, ran before all apps and libs are loaded. These will end with .init.ajs and will be loaded here.
					if (!file.endsWith(".init.ajs")) continue;

					const data = await red.fs.promises.readFile(
						directories["init"] + "/" + file,
					);
					redd.addInitScript(new TextDecoder("utf-8").decode(data));
				}
			}
		} catch (e) {
			red.logger.error(e);
		}
	}

	red.registerLib(new RedGlobalsLib());

	// Register built-in Node Polyfills
	red.registerLib(new NodeFS());
	red.registerLib(new NodePrelude());

	// Register vendored NPM packages
	red.registerLib(new Comlink());
	red.registerLib(new Mime());
	red.registerLib(new Fflate());

	// console.log("comlink proxy", swProxy);
	// console.log(await swProxy.test);
	// console.log(await swProxy.testfn());

	launcher = new Launcher(
		clickoffChecker as HTMLDivElement,
		updateClickoffChecker,
	);

	quickSettings = new QuickSettings(
		clickoffChecker as HTMLDivElement,
		updateClickoffChecker,
	);

	calendar = new Calendar(
		clickoffChecker as HTMLDivElement,
		updateClickoffChecker,
	);

	taskbar = new Taskbar();

	oobeview = new OobeView();

	document.body.classList.add("platform-" + red.platform.type);

	if (red.settings.get("blur-disable")) {
		document.body.classList.add("blur-disable");
	}

	Object.assign(window, {
		$store,
		red,
	});

	red.ui.init();

	if (!red.settings.get("oobe-complete")) {
		// This is a new install, so an old version containing the old extension
		// handler system can't be installed. We can skip the migration.
		red.settings.set("handler-migration-complete", true);
	}

	if (!red.settings.get("handler-migration-complete")) {
		// Convert legacy file handlers
		// This is a one-time migration
		const extHandlers = red.settings.get("FileExts") || {};

		console.debug("migrating file handlers");
		console.debug(extHandlers);

		for (const ext in extHandlers) {
			const handler = extHandlers[ext];
			if (handler.handler_type === "module") continue;
			if (handler.handler_type === "cjs") continue;
			if (typeof handler === "string") {
				if (handler === "/apps/libfileview.app/fileHandler.js") {
					extHandlers[ext] = {
						handler_type: "module",
						id: "red.fileviewer",
					};
					continue;
				}
				extHandlers[ext] = {
					handler_type: "cjs",
					path: handler,
				};
			}
		}
		red.settings.set("FileExts", extHandlers);
		red.settings.set("handler-migration-complete", true);
	}

	setTimeout(
		() => {
			setTimeout(() => {
				if (splashToRemove) {
					splashToRemove.classList.add("hide");
				}
			}, 350); // give the taskbar time to init
			setTimeout(() => {
				bootsplash.remove();
				bootsplashMobile.remove();
				gangstaBootsplash.remove();
			}, 550);
			red.logger.debug("boot completed");
			document.dispatchEvent(new Event("red-boot-completed"));
		},
		red.settings.get("oobe-complete") ? 500 : 1500,
	);
});

document.addEventListener("red-boot-completed", async () => {
	ReddHelpers.setStage("red.boot");
	if (red.settings.get("oobe-complete")) {
		document.dispatchEvent(new Event("red-login-completed"));
	} else {
		document.body.appendChild(oobeview.element);
	}
});

document.addEventListener("red-login-completed", async () => {
	ReddHelpers.setStage("red.login");
	const directories = red.settings.get("directories");
	red.ui.theme = Theme.new(red.settings.get("theme"));
	red.ui.theme.apply();
	ReddHelpers.setReady("red.ui.theme");

	const generic = new GenericApp();
	red.registerApp(generic);

	const browser = new BrowserApp();
	red.registerApp(browser);

	const settings = new SettingsApp();
	red.registerApp(settings);

	const taskmgr = new TaskManager();
	red.registerApp(taskmgr);

	const about = new AboutApp();
	red.registerApp(about);

	const wallpaper = new WallpaperAndStyle();
	red.registerApp(wallpaper);

	// const themeEditor = new ThemeEditor();
	// red.registerApp(themeEditor);

	const explore = new ExploreApp();
	red.registerApp(explore);

	const regedit = new RegEdit();
	red.registerApp(regedit);

	const dialog = new Dialog();
	const dialogApp = await red.registerApp(dialog);
	(red.dialog as any) = dialogApp;
	ReddHelpers.setReady("red.dialog");

	wallpaper.setWallpaper(
		red.settings.get("wallpaper") ||
			"/assets/wallpaper/bundled_wallpapers/Nocturne.jpg",
	);

	for (const bin of red.config.bin) {
		const path = bin.split("/").slice(-1)[0];
		try {
			await red.fs.promises.stat(directories.bin + "/" + path);
		} catch (e) {
			await red.fs.promises.writeFile(
				directories.bin + "/" + path,
				await fetch(bin).then((r) => r.text()),
			);
		}
	}

	for (const lib of red.config.libs) {
		await red.registerExternalLib(lib);
	}

	for (const app of red.config.apps) {
		await red.registerExternalApp(app);
	}

	// Initialize static UI components that utilize red.ui after loading apps, scripts, libs, so that external apps and libraries can apply overrides.
	await quickSettings.init();
	await calendar.init();
	await launcher.init();
	await taskbar.init();

	if (red.platform.type === "mobile") {
		// Adjust styles for Taskbar right
		const tright: HTMLDivElement =
			taskbar.element.querySelector("#taskbar-right")!;
		tright.style.backgroundColor = "black";
		tright.style.top = "0";
		tright.style.right = "0";
		tright.style.height = "25px";
		tright.style.transform = "translateY(0%)";
		tright.style.width = "100%";
		tright.style.zIndex = "1000000";

		// Adjust styles taskinfo-container (has date and battery)
		const tinfocont: HTMLDivElement = tright.querySelector(
			"#taskinfo-container",
		)!;
		tinfocont.style.background = "black";
		tinfocont.style.right = "0";
		tinfocont.style.position = "absolute";

		// Adjust styles for date container
		const tdatecon: HTMLDivElement = tright.querySelector("#date-container")!;
		tdatecon.style.background = "black";

		document.body.appendChild(tright);

		// Adjust launcher CSS
		launcher.element.style.left = "0";
		launcher.element.style.top = "25px";
		launcher.element.style.borderRadius = "0";
		const aview: HTMLDivElement = launcher.element.querySelector(".appsView")!;
		aview.style.gridTemplateColumns = "1fr 1fr 1fr 1fr";
		launcher.state.active = true;
	}

	document.body.appendChild(launcher.element);
	document.body.appendChild(launcher.clickoffChecker);
	document.body.appendChild(quickSettings.quickSettingsElement);
	document.body.appendChild(calendar.element);
	document.body.appendChild(quickSettings.notificationCenterElement);
	document.body.appendChild(taskbar.element);
	document.body.appendChild(alttab.element);
	red.systray = new Systray();
	ReddHelpers.setReady("red.systray");

	red.ui.theme.apply();

	(window as any).taskbar = taskbar;

	// Initializes apps and libs from userApps/ and userLibs/ and runs any user specified init scripts
	await bootUserCustomizations();

	if (!red.settings.get("x86-disabled")) {
		await bootx86();
	}

	if (red.settings.get("kiosk-mode")) {
		taskbar.element.remove();
		// There is a race condition here, but it doesn't matter
		// because this feature is a joke
		await sleep(1000);
		red.settings.get("kiosk-apps").forEach((app: string) => {
			red.apps[app].open();
		});
	}

	const desktopCtx = new ContextMenu(true); // we are init'ing before red so this is needed

	desktopCtx.addItem(
		"Set wallpaper & style",
		() => {
			// this however will execute after red is init'ed
			red.apps["red.wallpaper"].open();
		},
		"brush",
	);

	document.addEventListener("contextmenu", function (e) {
		if (e.shiftKey) return;
		e.preventDefault();
		if (e.target === document.body) {
			desktopCtx.show(e.clientX, e.clientY);
		}
	});

	document.addEventListener("keydown", (e) => {
		if (e.shiftKey && e.key.toLowerCase() === "tab") {
			e.preventDefault();
			alttab.onComboPress();
		}
		if (
			!navigator.platform.toUpperCase().includes("MAC") &&
			e.key.toLowerCase() === "meta" &&
			red.settings.get("launcher-keybind")
		) {
			quickSettings.close();
			calendar.close();
			launcher.toggleVisible();
			return;
		}
	});
	document.addEventListener("keyup", (e) => {
		// console.log("keyup", e);
		if (e.key.toLowerCase() === "shift") {
			alttab.onModRelease();
			return;
		}
	});

	red.initComplete = true;
	ReddHelpers.setReady("red.initComplete");
	taskbar.updateTaskbar();
	alttab.update();

	if (!red.settings.get("explore-shown")) {
		explore.open();
		red.settings.set("explore-shown", true);
	}
});
async function bootx86() {
	const mgr = new x86MgrApp();
	await red.registerApp(mgr);

	await red.registerApp(new XFrogApp());

	await red.registerApp(
		new XAppStub("X Calculator", "red.xcalc", "", "xcalc"),
	);
	await red.registerApp(new XAppStub("XTerm", "red.xterm", "", "xterm"));
	red.x86 = new V86Backend(red.x86hdd);
	ReddHelpers.setReady("red.x86");

	red.settings
		.get("user-xapps")
		.forEach((stub: { name: string; cmd: string; id: string }) => {
			console.debug("registering user xapp", stub);
			red.registerApp(new XAppStub(stub.name, stub.id, "", stub.cmd));
		});
	ReddHelpers.setStage("red.bootx86");
}
async function bootUserCustomizations() {
	const directories = red.settings.get("directories");
	console.debug("directories", directories);
	if ((await fetch("/fs/")).status === 404) {
		// Safe mode
		// Register recovery helper app
		const recovery = new RecoveryApp();
		red.registerApp(recovery);
		red.notifications.add({
			title: "Red Error",
			description:
				"Red has detected a system fault and booted in safe mode. Click this notification to enter the recovery app.",
			timeout: "never",
			callback: () => red.apps["red.recovery"].open(),
		});

		const safeMode = document.createElement("span");
		safeMode.style.position = "absolute";
		safeMode.style.bottom = "calc(48px + 1.5rem)";
		safeMode.style.color = "#ff5533";
		safeMode.style.fontWeight = "bold";
		safeMode.style.fontSize = "1.25rem";
		safeMode.style.right = "1.5rem";
		safeMode.style.textAlign = "left";
		safeMode.textContent = "Safe Mode";
		document.body.appendChild(safeMode);
	} else {
		// Not in safe mode
		// Load all user provided init scripts
		try {
			const files = await red.fs.promises.readdir(directories["init"]);
			// Fixes a weird edgecase that I was facing where no user apps are installed, nothing breaks it just throws an error which I would like to mitigate.
			if (files) {
				for (const file of files) {
					// Init scripts have 2 modes:
					// 1. Normal init scripts, ran after all apps and libs are loaded
					// 2. redd init scripts, ran before all apps and libs are loaded. These will end with .init.ajs and will not be loaded here.
					if (file.endsWith(".init.ajs")) continue;

					try {
						const data = await red.fs.promises.readFile(
							directories["init"] + "/" + file,
						);
						const script = `try {
                            ${new TextDecoder("utf-8").decode(data)}
                        } catch (e) {
                            console.error(e);
                        }`;

						const process = red.processes.create(script);
						process.title = file;
					} catch (e) {
						red.logger.error("Red failed to load a script " + e);
					}
				}
			}
		} catch (e) {
			red.logger.error(e);
		}
	}

	// Load all persistent sideloaded libs
	try {
		const files = await red.fs.promises.readdir(directories["libs"]);
		if (files === undefined) return;
		for (const file of files) {
			try {
				await red.registerExternalLib(`/fs/${directories["libs"]}/${file}/`);
			} catch (e) {
				red.logger.error("Red failed to load a lib", e);
			}
		}
	} catch (e) {
		red.logger.error(e);
	}

	// Load all persistent sideloaded apps
	try {
		const files = await red.fs.promises.readdir(directories["apps"]);
		if (files) {
			for (const file of files) {
				const { type } = await red.fs.promises.stat(
					`${directories["apps"]}/${file}`,
				);
				if (type === "DIRECTORY") {
					try {
						await red.registerExternalApp(
							`/fs/${directories["apps"]}/${file}/`,
						);
					} catch (e) {
						red.logger.error("Red failed to load an app", e);
					}
				} else {
					// This is a shortcut file
					const shortcut = JSON.parse(
						(
							await red.fs.promises.readFile(`${directories["apps"]}/${file}`)
						).toString(),
					);
					red.registerApp(new ShortcutApp(file, shortcut));
				}
			}
		}
	} catch (e) {
		red.logger.error(e);
	}

	ReddHelpers.setStage("red.bootUserCustomizations");
}
