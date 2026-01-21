import streamlit as st
import time
from utils import VideoUtils, AIEngine, PDFGenerator

# Page Config
st.set_page_config(
    page_title="Video to Genius",
    page_icon="✨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize Session State
if 'transcript' not in st.session_state:
    st.session_state.transcript = ""
if 'summary' not in st.session_state:
    st.session_state.summary = ""
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []
if 'metadata' not in st.session_state:
    st.session_state.metadata = None
if 'processing' not in st.session_state:
    st.session_state.processing = False

# Custom CSS for aesthetics
st.markdown("""
<style>
    .stButton>button {
        background-color: #4F46E5;
        color: white;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        border: none;
    }
    .stButton>button:hover {
        background-color: #4338ca;
    }
    .stTextInput>div>div>input {
        border-radius: 8px;
    }
    h1 {
        background: -webkit-linear-gradient(45deg, #3b82f6, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
</style>
""", unsafe_allow_html=True)

# Header
col1, col2 = st.columns([1, 4])
with col1:
    st.markdown("# ✨")
with col2:
    st.title("Video to Genius")
    st.caption("Transform YouTube videos into actionable insights with AI.")

# Sidebar
with st.sidebar:
    st.header("About")
    st.info("This application uses Llama-3 via Groq to analyze YouTube videos.")
    
    if st.session_state.metadata:
        st.divider()
        st.subheader("Current Video")
        if st.session_state.metadata.get('thumbnail'):
            st.image(st.session_state.metadata['thumbnail'], use_container_width=True)
        st.markdown(f"**{st.session_state.metadata['title']}**")
        st.markdown(f"*{st.session_state.metadata['channel']}*")

# Main Input
url = st.text_input("YouTube Video URL", placeholder="https://youtube.com/watch?v=...")

if url:
    process_button = st.button("Analyze Video", type="primary", disabled=st.session_state.processing)
    
    if process_button:
        st.session_state.processing = True
        video_id = VideoUtils.extract_video_id(url)
        
        if not video_id:
            st.error("Invalid YouTube URL")
            st.session_state.processing = False
        else:
            try:
                # Reset State
                st.session_state.transcript = ""
                st.session_state.summary = ""
                st.session_state.chat_history = []
                st.session_state.metadata = None
                
                with st.status("Processing video...", expanded=True) as status:
                    # 1. Metadata
                    st.write("Fetching metadata...")
                    metadata = VideoUtils.get_video_metadata(url)
                    st.session_state.metadata = metadata
                    st.write(f"Found: {metadata['title']}")
                    
                    # 2. Transcript
                    st.write("Extracting transcript (this may take a moment)...")
                    transcript = VideoUtils.get_transcript(video_id)
                    st.session_state.transcript = transcript
                    st.write("Transcript extracted!")
                    
                    status.update(label="Analysis Complete!", state="complete", expanded=False)
                
                st.session_state.processing = False
                st.rerun()

            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
                st.session_state.processing = False

# Content Area
if st.session_state.transcript:
    tab1, tab2, tab3 = st.tabs(["📄 Transcript", "✨ AI Summary", "💬 Chat"])
    
    with tab1:
        st.subheader("Full Transcript")
        st.text_area("Content", value=st.session_state.transcript, height=400)
        st.download_button(
            "Download Transcript (.txt)", 
            data=st.session_state.transcript, 
            file_name="transcript.txt"
        )
        
    with tab2:
        st.subheader("AI Summarization")
        if not st.session_state.summary:
            if st.button("Generate Summary"):
                with st.spinner("Generating summary with Llama-3..."):
                    try:
                        ai = AIEngine()
                        summary = ai.summarize(st.session_state.transcript)
                        st.session_state.summary = summary
                        st.rerun()
                    except Exception as e:
                        st.error(f"Summarization failed: {e}")
        else:
            st.markdown(st.session_state.summary)
            
            # PDF Export
            if st.button("Export to PDF"):
                try:
                    pdf_bytes = PDFGenerator.generate(
                        st.session_state.transcript, 
                        st.session_state.summary, 
                        st.session_state.metadata
                    )
                    st.download_button(
                        label="Download PDF Report",
                        data=pdf_bytes,
                        file_name="report.pdf",
                        mime="application/pdf"
                    )
                except Exception as e:
                    st.error(f"PDF generation failed: {e}")

    with tab3:
        st.subheader("Chat with Video")
        
        # Display chat history
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # Chat input
        if prompt := st.chat_input("Ask something about the video..."):
            # Add user message
            st.session_state.chat_history.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)

            # Generate response
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    try:
                        ai = AIEngine()
                        response = ai.chat(
                            st.session_state.transcript, 
                            st.session_state.chat_history[:-1], # History excluding current prompt
                            prompt
                        )
                        st.markdown(response)
                        st.session_state.chat_history.append({"role": "assistant", "content": response})
                    except Exception as e:
                        st.error(f"Chat failed: {e}")

else:
    # Empty state / Promo
    if not url:
        st.markdown("""
        <div style="text-align: center; padding: 2rem; opacity: 0.7;">
            <h3>Ready to analyze?</h3>
            <p>Paste a YouTube URL above to get started.</p>
        </div>
        """, unsafe_allow_html=True)
