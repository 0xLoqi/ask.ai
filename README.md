# AI Screenshot Assistant

A desktop application built with Electron that provides an AI-powered screenshot assistant. This tool allows you to capture screenshots and get AI-powered insights about them using hotkeys.

## Features

- Global hotkey support (Ctrl+Shift+Space by default) for quick screenshot capture
- AI-powered analysis of screenshots using Vision API
- System tray integration for easy access
- History viewer to track past interactions
- Persistent storage of conversation history
- Modern and intuitive user interface

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Electron

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd ai-screenshot-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

## Usage

1. The application runs in the system tray
2. Press Ctrl+Shift+Space (or your configured hotkey) to capture a screenshot
3. Enter your question about the screenshot in the popup window
4. View your interaction history through the tray menu

## Project Structure

- `main.js` - Main Electron process
- `preload.js` - Preload script for secure IPC communication
- `popup.html/js/css` - Main UI components
- `history.html/js/css` - History viewer components
- `assets/` - Application assets and icons

## Dependencies

- electron: ^29.1.5
- electron-store: ^8.2.0

## License

MIT License

## Author

[Your Name] <your.email@example.com> 