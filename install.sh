#!/bin/bash

glib-compile-schemas schemas/
mkdir -p ~/.local/share/gnome-shell/extensions/slingshot@rastersoft.com
cp -a * ~/.local/share/gnome-shell/extensions/slingshot@rastersoft.com/
