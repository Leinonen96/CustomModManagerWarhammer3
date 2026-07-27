# Total War: WARHAMMER III Lightweight Mod Manager

A fast, lightweight, and cross-platform mod manager for Total War: WARHAMMER III, built with Python, Flask, and a clean web interface. It manages your active load orders, generates symlinks directly into your game data directory, writes configuration files, and supports custom preset management.

## Features

- **Interactive Drag-and-Drop UI**: Easily sort your active load order and move mods between active and inactive pools using SortableJS.
- **Preset Management**: Save, load, and delete custom mod load-order presets as JSON files.
- **Cross-Platform Path Configuration**: Dynamically configure your Steam Workshop directory, Game Data directory, and User Script file (user.script.txt) straight from a graphical settings modal with built-in helper tooltips.
- **Automatic Symlinking**: Automatically links your subscribed .pack files into the game data folder and writes the proper load order configuration for the game engine.
- **Linux Desktop Integration**: Includes automated shortcut and application menu integration scripts for Linux environments.

## Prerequisites

- Python 3.x installed on your system
- Total War: WARHAMMER III installed via Steam

## How to Run the Program

### On Linux / macOS

Open your terminal in the project directory.

Run the start script (this will automatically create a Python virtual environment, install dependencies, generate a desktop shortcut on first run, and launch the server):

```bash
./start.sh
```

### On Windows

Double-click the `start.bat` file, or open a command prompt in the project folder and run:

```dos
start.bat
```

**Note**: The application will automatically spin up a local Flask server on port 5000 and open your default web browser to the manager interface.

## How to Use

### Initial Setup / Settings

On your first launch, a settings modal will appear.
Provide the absolute paths for your Workshop Directory, Game Data Directory, and User Script File (user.script.txt). You can hover over the ⓘ info icons next to each field if you need help finding what each path represents.
Click Save & Reload.

### Managing Mods

Your subscribed Steam workshop mods will appear under Available Mods (Inactive).
Drag and drop mods into the Active Load Order panel on the right. Mods at the top load first.

### Using Presets

Type a name into the preset text box and click Save / Update Preset to save your current load order configuration.
Select a saved preset from the dropdown menu and click Load Preset or Delete Preset as needed.

### Applying to the Game

Click the APPLY TO GAME button in the top control bar. This cleans up old links, creates fresh symlinks for your active mods, and updates your user.script.txt file so the game engine recognizes your load order.