class AboutApp extends App {
	name = "About Red";
	package = "red.about";
	icon = "/assets/icons/aboutapp.png";

	page = () => (
		<div class="aboutapp-container">
			<div class="aboutapp-logo">
				<div
					class="aboutapp-logo-img"
					title="Look what you've done"
					on:click={() => {
						red.apps["red.browser"].open([
							"https://www.youtube.com/watch?v=34Na4j8AVgA",
						]);
					}}
				></div>
			</div>
			<div class="aboutapp-logo-divider"></div>
			<div class="aboutapp-content">
				<p>RedOS</p>
				<p>
					Version {red.version.codename} ({red.version.pretty}) (OS build{" "}
					<button
						on:click={() => {
							red.apps["red.browser"].open([
								`https://github.com/MercuryWorkshop/redOS/commit/${this.getOSBuild()}`,
							]);
						}}
						class="aboutapp-link-button"
					>
						{this.getOSBuild()}
					</button>
					)
				</p>
				<p>© Mercury Workshop. All rights reserved.</p>
				<br />
				{$if(
					red.settings.get("x86-disabled"),
					<p>
						Red x86 subsystem disabled. <br /> Enable it in{" "}
						<button
							on:click={() => {
								red.apps["red.settings"].open();
							}}
							class="aboutapp-link-button"
						>
							settings
						</button>
						.
					</p>,
					<p>Red x86 subsystem enabled.</p>,
				)}

				<br />

				{$if(
					red.settings.get("bootFromOPFS"),
					<p>Red is booting from OPFS.</p>,
					<p>Red OPFS boot disabled.</p>,
				)}

				<br />
				<br />

				<p>
					This product is licensed under the{" "}
					<button
						on:click={() => {
							red.apps["red.browser"].open([
								"https://github.com/MercuryWorkshop/redOS/blob/main/LICENSE",
							]);
						}}
						class="aboutapp-link-button"
					>
						GNU AGPLv3
					</button>
					.
				</p>
			</div>
		</div>
	);

	constructor() {
		super();
	}

	async open(args: string[] = []): Promise<WMWindow | undefined> {
		let fullscreenEasterEgg = false;

		if (args.length > 0) {
			if (args.includes("fullscreen-easter-egg")) {
				fullscreenEasterEgg = true;
			}
			if (args.includes("fuller-screen-easter-egg")) {
				// You asked for it
				document.body.style.background =
					"url(/assets/images/idol.gif) no-repeat center center fixed";

				red.wm.windows.forEach((win) => {
					// No animation
					win.deref()!.element.style.display = "none";
					win.deref()!.close();
				});

				taskbar.element.remove();

				document.title = "Lagtrain";

				const icon = document.querySelector(
					"link[rel~='icon']",
				)! as HTMLLinkElement;

				icon.type = "image/gif";
				icon.href = "/assets/images/idol.gif";

				return;
			}
		}

		const aboutview = red.wm.create(this, {
			title: "",
			width: "400px",
			height: fullscreenEasterEgg ? "400px" : "450px",
			resizable: false,
		});

		if (fullscreenEasterEgg) {
			aboutview.content.appendChild(
				<div style="background: url(/assets/images/idol.gif); width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat;"></div>,
			);
		} else {
			aboutview.content.appendChild(this.page());
		}

		// make borderless
		aboutview.content.style.position = "absolute";
		aboutview.content.style.height = "100%";
		aboutview.content.style.display = "inline-block";

		const container = aboutview.content.parentElement;

		(container!.querySelector(".title") as any).style["background-color"] =
			"rgba(0, 0, 0, 0)";

		return aboutview;
	}

	getOSBuild(): string {
		const commit = red.settings.get("commit");
		if (!commit) return "unknown";
		return commit.slice(0, 7);
	}
}
