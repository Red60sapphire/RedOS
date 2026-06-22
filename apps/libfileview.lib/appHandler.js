const fflate = await red.import("npm:fflate");
const mime = await red.import("npm:mime");
const Buffer = Filer.Buffer;

const localPathToURL = (path) =>
	import.meta.url.substring(0, import.meta.url.lastIndexOf("/")) + "/" + path;

function unzip(zip, filter) {
	return new Promise((res, rej) => {
		fflate.unzip(zip, filter, (err, unzipped) => {
			if (err) rej(err);
			else res(unzipped);
		});
	});
}

async function handleAppView(
	type,
	manifest,
	iconData,
	sessionCallback,
	permanentCallback,
) {
	const icon = new Blob([iconData], {
		type: mime.default.getType(manifest.icon),
	});
	const iconUrl = URL.createObjectURL(icon);

	const win = red.wm.createGeneric({
		title: "",
		width: "450px",
		height: "525px",
	});

	win.onclose = () => {
		URL.revokeObjectURL(iconUrl);
	};

	const iframe = document.createElement("iframe");

	iframe.setAttribute(
		"src",
		localPathToURL(
			"appview.html?manifest=" +
				ExternalApp.serializeArgs([JSON.stringify(manifest), iconUrl, type]),
		),
	);

	iframe.style =
		"top:0; left:0; bottom:0; right:0; width:100%; height:100%; border:none; margin:0; padding:0;";

	win.content.appendChild(iframe);

	Object.assign(iframe.contentWindow, {
		red,
		ExternalApp,
		instanceWindow: win,
		install: {
			session: sessionCallback,
			permanent: permanentCallback,
		},
	});

	iframe.contentWindow.addEventListener("load", () => {
		const matter = document.createElement("link");
		matter.setAttribute("rel", "stylesheet");
		matter.setAttribute("href", "/assets/matter.css");
		iframe.contentDocument.head.appendChild(matter);
	});
}

async function createArchiveAppView(path, type) {
	let data = await red.fs.promises.readFile(path);

	path = path.split(".").slice(0, -1).join(".");

	const manifestZip = await unzip(
		new Uint8Array(data),
		(file) => file.name === "manifest.json",
	);
	const manifest = JSON.parse(
		new TextDecoder().decode(manifestZip["manifest.json"]),
	);
	const iconZip = await unzip(
		new Uint8Array(data),
		(file) => file.name === manifest.icon,
	);
	const iconData = iconZip[manifest.icon];

	const sessionCallback = async () => {
		const zip = await unzip(
			new Uint8Array(data),
			(file) => file.name === "manifest.json",
		);
		red.notifications.add({
			title: "Installing for Session",
			description: `${path.replace("//", "/")} is being installed, please wait`,
			timeout: 50000,
		});
		await red.fs.mkdir(`${path.replace("//", "/")}`);
		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await red.fs.promises.mkdir(`${path}/${relativePath}`);
				} else {
					red.fs.writeFile(
						`${path}/${relativePath}`,
						await Buffer.from(content),
					);
				}
			}
			await red.registerExternalApp(`/fs${path}`.replace("//", "/"));
			red.notifications.add({
				title: "Installed for Session",
				description: `${path.replace(
					"//",
					"/",
				)} has been installed temporarily, it will go away on refresh`,
				timeout: 50000,
			});
		} catch (e) {
			console.error(e);
		}
	};
	const permanentCallback = async () => {
		const zip = await unzip(
			new Uint8Array(data),
			(file) => file.name === "manifest.json",
		);
		red.notifications.add({
			title: "Installing",
			description: `${path.replace("//", "/")} is being installed, please wait`,
			timeout: 50000,
		});
		await red.fs.promises.mkdir(
			// this is a dumb hack but i dont want to make 2 functions
			red.settings.get("directories")[type + "s"] +
				"/" +
				path.split("/").slice("-1")[0],
		);

		try {
			for (const [relativePath, content] of Object.entries(zip)) {
				if (relativePath.endsWith("/")) {
					await red.fs.promises.mkdir(
						`${red.settings.get("directories")[type + "s"]}/${path.split("/").slice("-1")[0]}/${relativePath}`,
					);
				} else {
					await red.fs.promises.writeFile(
						`${red.settings.get("directories")[type + "s"]}/${path.split("/").slice("-1")[0]}/${relativePath}`,
						Buffer.from(content),
					);
				}
			}
			await red.registerExternalApp(
				`/fs${red.settings.get("directories")[type + "s"]}/${path.split("/").slice("-1")[0]}`.replace(
					"//",
					"/",
				),
			);
			red.notifications.add({
				title: "Installed",
				description: `${path.replace(
					"//",
					"/",
				)} has been installed permanently`,
				timeout: 50000,
			});
		} catch (e) {
			console.error(e);
		}
	};
	handleAppView(type, manifest, iconData, sessionCallback, permanentCallback);
}

async function createFolderAppView(path, type) {
	let manifest;
	try {
		manifest = await red.fs.promises.readFile(`${path}/manifest.json`);
		manifest = JSON.parse(manifest);
	} catch {
		return;
	}

	const iconData = await red.fs.promises.readFile(`${path}/${manifest.icon}`);
	const sessionCallback = async () => {
		await red.registerExternalApp(`/fs${path}`.replace("//", "/"));
		red.notifications.add({
			title: "Application Installed for Session",
			description: `Application ${path.replace(
				"//",
				"/",
			)} has been installed temporarily, it will go away on refresh`,
			timeout: 50000,
		});
		win.close();
	};
	const permanentCallback = async () => {
		await red.fs.promises.rename(
			path,
			red.settings.get("directories")["apps"] +
				"/" +
				path.split("/").slice("-1")[0],
		);
		await red.registerExternalApp(
			`/fs${red.settings.get("directories")["apps"]}/${path.split("/").slice("-1")[0]}`.replace(
				"//",
				"/",
			),
		);
		red.notifications.add({
			title: "Application Installed",
			description: `Application ${path.replace("//", "/")} has been installed permanently`,
			timeout: 50000,
		});
		win.close();
	};

	handleAppView(type, manifest, iconData, sessionCallback, permanentCallback);
}
async function getArchiveAppIcon(path) {
	let data = await red.fs.promises.readFile(path);

	const zip = await unzip(
		new Uint8Array(data),
		(file) => file.name === "manifest.json",
	);
	const manifest = JSON.parse(new TextDecoder().decode(zip["manifest.json"]));
	const iconZip = await unzip(
		new Uint8Array(data),
		(file) => file.name === manifest.icon,
	);
	const icon = new Blob([iconZip[manifest.icon]], {
		type: mime.default.getType(manifest.icon),
	});
	let iconUrl = URL.createObjectURL(icon);
	return iconUrl;
}

async function getFolderAppIcon(path) {
	let manifest;
	try {
		manifest = await red.fs.promises.readFile(`${path}/manifest.json`);
		manifest = JSON.parse(manifest);
	} catch {
		return red.files.fallbackIcon;
	}
	let iconData;
	try {
		iconData = await red.fs.promises.readFile(`${path}/${manifest.icon}`);
	} catch {
		return red.files.fallbackIcon;
	}
	const icon = new Blob([iconData], {
		type: mime.default.getType(manifest.icon),
	});
	const iconUrl = URL.createObjectURL(icon);
	return iconUrl;
}

export {
	createArchiveAppView,
	createFolderAppView,
	getArchiveAppIcon,
	getFolderAppIcon,
};
