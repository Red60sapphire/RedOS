#!/bin/bash
set -euxo pipefail

sudo apt update
sudo apt upgrade -y
sudo apt install -y build-essential clang default-jre gcc-multilib uuid-runtime

# Install pnpm globally
npm install -g pnpm

git submodule update --init
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --target wasm32-unknown-unknown,i686-unknown-linux-gnu
source "$HOME/.cargo/env"
make all
