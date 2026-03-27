# MedFlow AI: Local Setup Guide (Ollama + Llama 3.1)

This guide explains how to run the **Python + Ollama** version of MedFlow AI on your local machine. This setup uses open-source models and does not require a Gemini API key.

## 1. Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com).

## 2. Pull the Model
Open your terminal and run:
```bash
ollama pull llama3.1
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
2. In `src/services/medflowService.ts`, set `USE_LOCAL_BACKEND = true`.
3. Start the development server:
   ```bash
   npm run dev
   ```

## 5. GitHub Repository
For the complete source code, deployment scripts, and advanced configuration, please visit the official GitHub repository:
[https://github.com/your-username/medflow-ai](https://github.com/your-username/medflow-ai)

## 6. How it works
The frontend will now send clinical notes to your local Python server (`localhost:8000`), which uses Ollama to process the text using the `llama3.1` model. The deterministic rule engine still runs to ensure coding accuracy.
