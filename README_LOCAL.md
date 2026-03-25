# MedFlow AI: Local Setup Guide

This guide explains how to run the **Python + Ollama** version of MedFlow AI on your local machine.

## 1. Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com).

## 2. Pull the Model
Open your terminal and run:
```bash
ollama pull llama3
```
*(You can also use `mistral` or `phi3` if you update `server.py` accordingly)*

## 3. Setup Python Backend
1. Ensure you have Python 3.10+ installed.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   python server.py
   ```
   The backend will be running at `http://localhost:8000`.

## 4. Setup Frontend
1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## 5. Connecting Frontend to Python
In `src/services/medflowService.ts`, you can update the `processClinicalNote` function to fetch from `http://localhost:8000/analyze` instead of calling the Gemini SDK directly.

---
**Note:** The cloud version uses Gemini because Ollama requires local hardware acceleration.
