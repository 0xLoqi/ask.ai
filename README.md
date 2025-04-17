# ask.ai

Answers in an instant.

A desktop application built with Electron that provides an AI-powered screenshot assistant with voice input capabilities. This tool allows you to capture screenshots and get AI-powered insights about them using voice commands and hotkeys.

## Features

- Voice input as primary query method
- Global hotkey support (Ctrl+Shift+Space by default) for quick access
- AI-powered analysis of screenshots using Vision API
- System tray integration for easy access
- History viewer to track past interactions
- Persistent storage of conversation history
- Modern and intuitive user interface with status indicators
- Configurable screenshot preview visibility
- Multiple input modes:
  - Voice input with automatic transcription
  - Text input with manual screenshot capture
  - Combined voice and screenshot analysis

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Electron
- Microphone access (for voice input)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/0xLoqi/ask.ai.git
cd ask.ai
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
2. Press Ctrl+Shift+Space (or your configured hotkey) to open the popup
3. Choose your input method:
   - Voice: Speak your question (automatically transcribed)
   - Text: Type your question
4. Select how to send your query:
   - "Send": Text-only analysis
   - "Send with New Screenshot": Capture and analyze with current screen
5. View your interaction history through the tray menu

## Project Structure

- `main.js` - Main Electron process
- `preload.js` - Preload script for secure IPC communication
- `popup.html/js/css` - Main UI components with voice input
- `history.html/js/css` - History viewer components
- `assets/` - Application assets and icons

## Dependencies

- electron: ^29.1.5
- electron-store: ^8.2.0

## License

MIT License

## Author

0xLoqi <E.wbanks@yahoo.com> 