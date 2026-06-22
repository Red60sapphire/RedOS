class x86MgrApp extends App {
	name = "x86 Manager";
	package = "red.x86mgr";
	icon = "/assets/icons/xorg.svg";

	constructor() {
		super();
	}

	async open(): Promise<WMWindow | undefined> {
		const win = red.wm.create(this, {
			title: "x86",
			width: "700px",
			height: "500px",
		});

		win.content.style.backgroundColor = "#000";
		win.content.appendChild(red.x86!.screen_container);

		taskbar.updateTaskbar();
		alttab.update();

		return win;
	}
}
