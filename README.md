![RedOS logo](/assets/logo_dark.png#gh-light-mode-only)
![RedOS logo](/assets/logo_light.png#gh-dark-mode-only)

The next-gen webOS and development environment with full Linux emulation.

---

## What is RedOS?

An entirely local browser-based "OS" and development environment with complete graphical Linux emulation, visually based on ChromiumOS. See a demo [here](https://red.pro), fully in your browser.

> [!WARNING]  
> Red mainly targets Chromium but should work on most browsers. For a list of known browser specific quirks check [this document](BrowserQuirks.md).

Red uses the features of a PWA (Progressive Web App) to make its environment work fully offline, providing a virtual filesystem (synced with the Linux emulator), a code editor, and a modular and extensible app system. You can even edit Red's code live while inside of it!

Red shows as more of a proof-of-concept with what's possible on the modern web rather than an actual product. However, it proves useful in many actual cases and is a useful educational tool.

## Development

> [!IMPORTANT]  
> Red will not build on Windows. Please use a Linux VM or WSL.

### Easy Install for GitHub Codespaces

- Run `source codespace-basic-setup.sh`

> [!NOTE]
>
> - If you are not in a codespace skip to the regular installation steps.
> - This does NOT build RootFS.

### Dependencies

- `make`
- Node.js (24+)
- PNPM
- `jq`
- `uuid-runtime`
- `rustup`
- `wasm-bindgen` (v0.2.105)
- `wasm-opt`
- [this `wasm-snip` fork](https://github.com/r58Playz/wasm-snip)
- A recent version of `java` (11+)
- `wget`
- `clang`
- `gcc` (`gcc-multilib` on Debian and Ubuntu x86_64)
- 32 bit version of `glibc` (needed for building rootfs, `lib32-glibc` on Arch Linux)
- `docker`
- An x86(-64) Linux PC (`make rootfs-alpine` build depends on x86 specific tools)

> [!NOTE]
> You will have to install the required Rust toolchain by running `rustup target add wasm32-unknown-unknown` and also `rustup target add i686-unknown-linux-gnu` if you are planning to build v86 images.

#### Building

- Clone the repository with `git clone --recursive https://github.com/MercuryWorkshop/redOS`
- Then, `make all`

> [!TIP]
> You can use `make all -B` instead if you want to force a full build.

### Building the Linux RootFS

- Make sure you have `Docker` installed and running.
- Make sure to add yourself to the Docker group using `usermod -a -G docker $USER`
- Run `make rootfs`

### Running Red Locally

You can run Red with the command

```sh
make server
```

Red should now be running at `localhost:8000`.

## App Development

App development is highly encouraged! Good apps can even be added to the official app repositories after review by an RedOS maintainer. Apps are stored in .app files which are read by RedOS to provide you, well, an app!

For more information about developing an RedOS app please visit [this page](./documentation/appdevt.md) and for using Red API's in your code, please visit [this page](./documentation/Red-API.md).

## Documentation

See the current index of documentation [here](./documentation/README.md).

## Security

See [SECURITY.md](./SECURITY.md) for reporting instructions.

## Credits

RedOS is created by [Mercury Workshop](https://mercurywork.shop). Linux emulation is based off of the [v86](https://github.com/copy/v86) project. For more credits, see [CREDITS.MD](./CREDITS.md).

(p.s. for hackers: the entrypoint to red is [src/Boot.tsx](./src/Boot.tsx))
