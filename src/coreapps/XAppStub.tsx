class XAppStub extends App {
	command: string;
	constructor(
		name: string,
		packageIdent: string,
		icon: string,
		command: string,
	) {
		super();
		this.name = name;
		this.package = packageIdent;
		this.icon = icon || "/assets/icons/xfrog.png";
		this.command = command;
	}
	async open() {
		red.x86?.runcmd(this.command);
		red.x86?.screen_container.remove();
	}
}
