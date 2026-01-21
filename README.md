# Video to Genius (Python Edition)

A Llama-3 powered application to analyze YouTube videos, generate summaries, and chat with video content.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Environment Variables**:
    Create a `.env` or `.env.local` file with your Groq API key:
    ```
    GROQ_API_KEY=your_api_key_here
    ```

3.  **Run**:
    ```bash
    streamlit run main.py
    ```

## Stack
- **Python**: Core language
- **Streamlit**: UI Framework
- **Llama 3.3 (via Groq)**: AI Intelligence
- **yt-dlp**: Video extraction
