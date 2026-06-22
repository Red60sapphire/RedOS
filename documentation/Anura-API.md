# The Red Internal API

This document has a brief explanation of all the Red JS APIs and how to use them.

## red.settings

This API is used to define system settings in Red, it is a key value store of JS objects.

### Functions

#### red.settings.get: `string | undefined`

This api allows you to get a value in the key value store.

**Usage:**

```js
red.settings.get("applist"); // Get pinned apps in red's taskbar
```

#### red.settings.set: `void`

This allows you to set a value in the key value store.

**Usage:**

```js
red.settings.set("launcher-keybind", false); // Disables the launcher keybind.
```

## red.import

This API is used to import libraries. These libraries are similar to apps and can be installed from the Marketplace or sideloaded through the File Manager.

**Usage:**

```js
const browser = await red.import("red.libbrowser");

browser.openTab("https://google.com/");
```

RedOS provides some preinstalled libraries to help streamline the development experience. This includes the browser library as shown above, along with the red persistence library and the file picker.

You can find the documentation for the preinstalled libraries [here](./appdevt.md#system-libraries).

## red.x86

This API provides access to Red's x86 backend; Which is used to create PTYs, write directly to serial terminals (not recommended) or access v86 itself.

### Properties

#### red.x86.emulator: `V86Emulator`

This is the v86 emulator object, you can find more documentation on it [here](https://github.com/copy/v86).

#### red.x86.screen_container: `HTMLDivElement`

This is a element containing a canvas with the emulated v86 screen.

### Functions

#### red.x86.openpty: `number`

This allows you to open a PTY and run commands inside of it. It returns the number of the PTY and is used in other interactions.

**Usage:**

```js
const pty = await red.x86.openpty(
	"/bin/bash",
	screenSize.width,
	screenSize.height,
	(data) => {
		// callback gets called every time the PTY returns data
	},
);
```

#### red.x86.writepty: `void`

This allows you to send data to a PTY. This data should be a string or converted to one.

**Usage:**

```js
const pty = await red.x86.openpty(
	"/bin/bash",
	screenSize.width,
	screenSize.height,
	(data) => {
		console.log(data);
	},
);
red.x86.writepty(pty, "Hello World!");
```

#### red.x86.resizepty: `void`

This allows you to resize a PTY.

**Usage:**

```js
const pty = await red.x86.openpty(
	"TERM=xterm DISPLAY=:0 bash",
	screenSize.width,
	screenSize.height,
	(data) => {
		console.log(data);
	},
);
red.x86.resizepty(pty, screenSize.height, screenSize.width);
```

## red.x86hdd

This api allows you to interact with the v86 virtual hard disk.

### Properties

#### red.x86hdd.size: `number`

This is the size of the v86 hard disk in bytes.

### Functions

#### red.x86hdd.loadfile: `void`

This allows you to load a image into the x86 hard disk.

**Usage:**

```js
// single file
const rootfs = await fetch(red.config.x86[x86image].rootfs);
const blob = await rootfs.blob();
await red.x86hdd.loadfile(blob);

// split into multiple files
const files = [];
let file_1 = await fetch(red.config.x86[x86image].rootfs[0]);
files[0] = await file_1.blob();
let file_2 = await fetch(red.config.x86[x86image].rootfs[1]);
files[1] = await file_2.blob();
await red.x86hdd.loadfile(new Blob(files));
```

#### red.x86hdd.delete: `void`

Deletes the x86 hard disk and refreshes the page. This is a destructive action!

**Usage:**

```js
console.log("deleting hard disk");
await red.x86hdd.delete();
```

#### red.x86hdd.resize: `void`

Resizes the x86 hard disk by adding empty bytes to the image. The

**Usage:**

```js
console.log("rezising hard disk")
red.x86?.emulator.stop();
clearInterval(
    red.x86?.saveinterval,
);
await red.x86.resize(4294967296) // 4 GB
// make the os able to see the empty bytes
const emulator = new V86Starter(
    {
        wasm_path:
            "/lib/v86.wasm",
        memory_size:
            512 * 1024 * 1024,
        vga_memory_size:
            8 * 1024 * 1024,
        screen_container:
            red.x86!
                .screen_container,

        initrd: {
            url: "/x86images/resizefs.img",
        },

        bzimage: {
            url: "/x86images/bzResize",
            async: false,
        },
        hda: {
            buffer: red.x86hdd,
            async: true,
        },

        cmdline:
            "random.trust_cpu=on 8250.nr_uarts=10 spectre_v2=off pti=off",

        bios: {
            url: "/bios/seabios.bin",
        },
        vga_bios: {
            url: "/bios/vgabios.bin",
        },
        autostart: true,
        uart1: true,
        uart2: true,
    },
);
let s0data = "";
emulator.add_listener(
    "serial0-output-byte",
    async (byte: number) => {
        const char =
            String.fromCharCode(
                byte,
            );
        if (char === "\r") {
            red.logger.debug(
                s0data,
            );

            if (
                s0data.includes(
                    "Finished Disk",
                )
            ) {
                await red.x86hdd.save(
                    emulator,
                );
                this.state.resizing =
                    false;
                if (
                    document.getElementById(
                        "resize-disk-btn",
                    )
                ) {
                    document.getElementById(
                        "resize-disk-btn",
                    )!.innerText =
                        "Resize Disk";
                }
                confirm(
                    "Resized disk! Would you like to reload the page?",
                )
                    ? window.location.reload()
                    : null;
            }

            s0data = "";
            return;
        }
        s0data += char;
    },
);
```

#### red.x86hdd.save: `void`

This allows you to save the v86 hard disk and sends a notification to the user.

**Usage:**

```js
console.log("saving hard disk");
await red.x86hdd.save();
```

## red.wm

### Properties

#### red.wm.windows: `Array<WeakRef<WMWindow>>`

This is an array of WeakRefs that contain WMWindows that are in the red wm.

### Functions

#### red.wm.create: `WMWindow`

This api allows you to create a window that will be displayed in the DE.

**Usage:**

```js
let win = red.wm.create(instance, {
	title: "Example Window",
	width: "1280px",
	height: "720px",
});

// do things with the window that gets returned
```

#### red.wm.createGeneric: `WMWindow`

This is is the same as the `red.wm.create` api but creates a window under the Generic App instance.

**Usage:**

```js
let win = red.wm.createGeneric({
	title: "Example Window",
	width: "1280px",
	height: "720px",
});

// another use case
let win = red.wm.createGeneric("Example Window");

// do stuff with the window that gets returned
```

## red.logger

This API provides a logger for Red, which just wraps the console object.

### Functions

#### Wrapper Functions

| Function             | Description           |
| -------------------- | --------------------- |
| `red.logger.log`   | Wraps `console.log`   |
| `red.logger.debug` | Wraps `console.debug` |
| `red.logger.info`  | Wraps `console.info`  |
| `red.logger.warn`  | Wraps `console.warn`  |
| `red.logger.error` | Wraps `console.error` |

#### red.logger.createStreams(prefix?: string): `{stdout: WritableStream, stderr: WritableStream}`

This function creates a pair of writable streams that processes can be piped to
for console output. The prefix argument is optional and will be prepended to all
log messages.

**Usage:**

```js
const { stdout, stderr } = red.logger.createStreams("my-process: ");

const proc = await red.processes.execute("/path/to/script.ajs");

proc.stdout.pipeTo(stdout);
proc.stderr.pipeTo(stderr);
```

## red.net

This API provides access to Red's networking backend, for routing your requests through a [Wisp](https://github.com/MercuryWorkshop/wisp-protocol) compatible backend using [libcurl.js](https://github.com/ading2210/libcurl.js).\

### Properties

#### red.net.libcurl

This part of the api gives you full access to the libcurl.js APIs directly. You can learn more on how to use them [here](https://github.com/ading2210/libcurl.js?tab=readme-ov-file#javascript-api).

### Functions

#### red.net.fetch: `Response`

This has the same functionality as the DOM fetch function. It returns a `Response` and takes in a URL with options or a Request object.

**Usage:**

```js
let response = await red.net.fetch("https://red.pro/MILESTONE");
console.log(await response.text());
```

### Constructors

#### red.net.WebSocket: `WebSocket`

This has the same functionality as the built in DOM function and works identically as the regular `WebSocket` constructor.

**Usage:**

```js
let ws = new red.net.WebSocket("wss://echo.websocket.in/");
ws.addEventListener("open", () => {
	console.log("ws connected!");
	ws.send("hello".repeat(128));
});
ws.addEventListener("message", (event) => {
	console.log(event.data);
});
```

## red.fs

This API provides access the Red's internal filesystem, loosely following the node filesystem spec(slightly out of date).

The best documentation on the usage of this API can probably be found [Here](https://github.com/filerjs/filer).

### Functions

#### red.fs.installProvider: `void`

This function allows for the registration of virtual filesystems. These must extend the AFSProvider class and implement all of the filesystem methods. Here is an example for registering an instance of the built in LocalFS provider.

**Usage:**

```js
await red.fs.promises.mkdir("/local-mnt");

const dirHandle = await window.showDirectoryPicker();
dirHandle.requestPermission({ mode: "readwrite" });

red.fs.installProvider(new LocalFS(dirHandle, redPath));
```

## red.files

This API provides access to Red's file service, it is useful for handling the opening of files and setting file handlers.

### Functions

#### red.files.open `void`

This method takes a file path and then opens this file using the file handler for the file, falling back to the default if it doesnt have a handler for it.

**Usage:**

```js
red.files.open("/config_cached.json"); // uses file handler to open json
```

#### red.files.getIcon: `string`

This method takes a path and returns an icon based on the file extension using a file handler.

**Usage:**

```js
red.files.getIcon("/config_cached.json"); // returns icon for json
```

#### red.files.getFileType: `string`

This method takes a path and returns a human readable file type based on the file extension using a file handler.

**Usage:**

```js
red.files.getFileType("/config_cached.json"); // returns icon for json
```

#### red.files.setModule: `void`

This method takes an red library that has an `openFile` function that takes a `path`.

**Usage:**

```js
red.files.setModule("red.fileviewer", "png"); // set red.fileviewer library as default handler for png
```

## red.uri

This API provides access to Red's URI handler. It is useful for handling the opening of URIs and setting URI handlers.

### Functions

#### red.uri.handle: `void`

This method takes a URI and then opens this URI using the handlers that have been registered for it.

**Usage:**

```js
red.uri.handle("https://google.com"); // opens google.com in the default browser
```

#### red.uri.set: `void`

This method takes a protocol and a URIHandlerOptions interface and sets the handler for the protocol.

The URIHandlerOptions interface is defined in [URIHandler.ts](/src/api/URIHandler.ts)

**Usage:**

```js
red.uri.set("https", {
    handler: {
        // Specifies that the handler is a library
        tag: "lib",
        // The package name of the library
        pkg: "red.browser,
        // The (optional) version of the library
        version: "1.0.0",
        // The function to call in the library
        import: "openTab",
    },
    // The (optional) prefix to be prepended to the URI
    prefix: "https:",
});
```

#### red.uri.remove: `void`

This method takes a protocol and removes the handler for the protocol.

**Usage:**

```js
red.uri.remove("https");
```

#### red.uri.has: `boolean`

This method takes a protocol and returns a boolean indicating if the protocol has a handler.

**Usage:**

```js
red.uri.has("https"); // Should always return true because the browser registers itself as the handler for https automatically
```

## red.notifications

This API provides access to Red's notification service, useful if you need to display an alert to the user.

### Functions

#### red.notifications.add: `void`

This api allows you to add a notification to the notification service and have a callback that executes along with it.

**Usage:**

```js
red.notifications.add({
	title: "Test Notification",
	description: `This is a test notification`,
	callback: function () {
		console.log("hi");
	},
	timeout: 2000,
}); // Show a notification to the user, on click, it says hi in console, it lasts for 2 seconds.
```

<!--🫃🏿-->

## red.processes

This API allows you to manage processes running in red.

### Properties

#### red.processes.procs

Returns a list of all the processes running in red, as a dreamland stateful
array of WeakRefs to the processes.

Note: You should never directly mutate this array, use the provided APIs instead.

### Functions

#### red.processes.remove: `void`

This API allows you to remove a process from the process list. This is usually ran as
the last function of a processes kill function.

**Usage:**

```js
function kill() {
	red.processes.remove(this.pid);
}
```

#### red.processes.register: `void`

This API allows you to register a process with the process list. This is usually ran
by the constructor of a process.

**Usage:**

```js
// SpecialProcess extends Process
const process = new SpecialProcess();

red.processes.register(process);
```

#### red.processes.create: `IframeProcess`

This API allows you to create a process from the given script and type.

**Usage:**

```js
red.processes.create("print('Hello, ' + await readln())", "module");
```

#### red.processes.execute: `IframeProcess`

This API allows you to execute a process from the given script file path

**Usage:**

```js
await red.processes.execute("/path/to/script.ajs");
```

## red.sw

This API provides a special process that wraps the red service worker. This
process claims PID 0 and when it is killed, it will unregister the service worker
and reload the page.

## red.redd

This API provides a special process that wraps the red daemon. This process claims PID 1 and manages all red init scripts.

An example of an init script can be found in [this document](./templates/template.init.ajs)

Note: All redd init scripts must have the `.init.ajs` extension, and contain a
shebang-like header like so:

```
#! {"lang":"module"}
```

### Properties

#### red.redd.initScripts: `IframeProcess[]`

This is an array of running init scripts, which are a special process type.
This array is not stateful and direct mutations are allowed.

### Functions

#### red.redd.addInitScript: `void`

This API allows you to add an init script to the red daemon.

**Usage:**

```js
const script = `
export name = "example";
export description = "This is an example init script";

export start = async () => {
    console.log("Hello, World!");
};
`;

await red.redd.addInitScript(script);
```

### red.redd.kill: `void`

This function kills the red daemon and all running init scripts.

**Usage:**

```js
red.redd.kill();
```

## red.wsproxyURL

This API returns a usable wsproxy url for any TCP application.

**Usage:**

```js
let webSocket = new WebSocket(red.wsproxyURL + "alicesworld.tech:80", [
	"binary",
]);

webSocket.onmessage = async (event) => {
	const text = await (await event.data).text();

	console.log(text);
};

webSocket.onopen = (event) => {
	webSocket.send("GET / HTTP/1.1\r\nHost: alicesworld.tech\r\n\r\n");
};

// Sends HTTP 1.1 request to alicesworld.tech using wsproxy
```

## red.ContextMenu

This API creates a red style context menu you can use in your apps.

**Usage:**

```js
const contextmenu = new red.ContextMenu();
contextmenu.addItem("Log to console", function () {
	console.log("hello world!");
});
element.addEventListener("contextmenu", (e) => {
	e.preventDefault();
	const boundingRect = window.frameElement.getBoundingClientRect();
	contextmenu.show(e.pageX + boundingRect.x, e.pageY + boundingRect.y);
	document.onclick = (e) => {
		document.onclick = null;
		contextmenu.hide();
		e.preventDefault();
	};
});
```

### Functions

#### red.ContextMenu.addItem: `void`

This adds an item to the context menu item with a callback thats executed on selection of that menu item.

```js
const contextmenu = new red.ContextMenu();
contextmenu.addItem("Log to console", function () {
	console.log("hello world!");
});
```

#### red.ContextMenu.show: `void`

This makes the context menu visible to the user, it also takes arguments on where to place it on the page.

```js
const contextmenu = new red.ContextMenu();
contextmenu.addItem("Log to console", function () {
	console.log("hello world!");
});
contextmenu.show(e.pageX + boundingRect.x, e.pageY + boundingRect.y); // place context menu where the mouse is
```

#### red.ContextMenu.hide: `void`

This hides the context menu from the user.

```js
const contextmenu = new red.ContextMenu();
contextmenu.addItem("Log to console", function () {
	console.log("hello world!");
});
contextmenu.hide();
```

## red.dialog

This API provides dialogs for Red. For app developers, these should be used instead of using native browser dialogs to keep the user inside of the desktop environment and to make your app integrate better with Red.

### Functions

#### red.dialog.alert

This creates a alert dialog window.

**Usage:**

```js
red.dialog.alert("Hello World!");
```

#### red.dialog.confirm: `boolean`

This creates a dialog window that gives the user a prompt to confirm an action. This function returns a `boolean` you can use.

**Usage:**

```js
let confirm = await red.dialog.confirm("Are you sure?");
if (confirm) {
	console.log("They were sure.");
}
```

#### red.dialog.prompt: `string | null`

This gives a user a dialog prompt where the user can enter text. If the user decides to not input text and a default value exists, it returns that instead or returns null if none of those are met.

**Usage:**

```js
let input = await red.dialog.prompt("What is your favorite number?");
if (input) {
	console.log(input);
}

// default value mode
let input = await red.dialog.prompt("What is your favorite number?", "3");
if (input) {
	console.log(input);
}
```

#### red.dialog.progress: `object`

This gives the user a dialog box showing the progress of a current applications activity. The message shown and the progress is returned to give the developer the option on what to show. When the progress on this dialog is greater than or equal to 1, the window will automatically close.

**Usage:**

```js
const dialog = red.dialog.progress("Initializing...");
await sleep(100);
dialog.detail = "Stage One";
dialog.progress = 0.2;
await sleep(100);
dialog.detail = "Stage Two";
dialog.progress = 0.4;
await sleep(100);
dialog.detail = "Stage Three";
dialog.progress = 0.8;
await sleep(100);
dialog.detail = "Stage Four";
dialog.progress = 1;
```

## red.systray

### Properties

#### red.systray.element: `HTMLSpanElement`

This property contains the element that contains all of the

#### red.systray.icons: `SystrayIcon[]`

This property contains alll of the icons in the systray in an array.

### Functions

#### red.systray.create: `SystrayIcon`

This function allows you to create an object in the systray, you can pass in an icon and a tooltip to be rendered.

**Usage:**

```js
const sysicon = red.systray.create({
	icon: "data:image/svg+xml;base64,BASE64ICON",
	tooltip: "Red AdBlock Active",
});
sysicon.onclick = (event) => {
	console.log("got left click event");
};
sysicon.onrightclick = (event) => {
	console.log("got right click event");
};
```

## red.platform

This API provides information about the platform that Red is running on.

### Properties

#### red.platform.type: `string`

This property returns the type of platform that Red is running on. This can be one of the following values:

- `desktop` - Red is running on a desktop.
- `mobile` - Red is running on a mobile phone.
- `tablet` - Red is running on a tablet.

#### red.platform.touchInput: `boolean`

This property returns a boolean indicating whether the platform supports touch input.

## red.ui.theme

### Functions

#### red.ui.theme.css: `string`

Returns a CSS style you can append to your document's `head` to provide styles for your application:

**Example:**

```js
// Append theme css element (with dreamland)
document.head.appendChild(
	html`<><style data-id="red-theme">${red.ui.theme.css()}</style></>`,
);

// Append theme css element (without dreamland)
const style = document.createElement("style");
dataset.example.id = "red-theme";
dataset.innerHTML = red.ui.theme.css();
document.head.appendChild(style);

document.addEventListener("red-theme-change", () => {
	document.head.querySelector('style[data-id="red-theme"]').innerHTML =
		red.ui.theme.css();
});
```

You now have the following CSS variables to use, corresponding to the properties listed below.

- `--theme-fg`
- `--theme-secondary-fg`
- `--theme-border`
- `--theme-dark-border`
- `--theme-bg`
- `--theme-secondary-bg`
- `--theme-dark-bg`
- `--theme-accent`

### Properties

#### red.ui.theme.accent: `string`

The accent of the theme in hex.

#### red.ui.theme.background: `string`

The background color of the theme in hex.

#### red.ui.theme.darkBackground: `string`

The dark background color of the theme in hex.

#### red.ui.theme.secondaryBackground: `string`

The secondary background color of the theme in hex.

#### red.ui.theme.border: `string`

The border color of the theme in hex.

#### red.ui.theme.darkBorder: `string`

The dark border color of the theme in hex.

#### red.ui.theme.foreground: `string`

The foreground/text color of the theme in hex.

#### red.ui.theme.secondaryForeground: `string`

The secondary foreground color of the theme in hex.
