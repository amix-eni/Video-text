import os
import re
import time
from typing import Optional, Dict, List, Union
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from groq import Groq
from fpdf import FPDF
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv('.env.local')

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class VideoUtils:
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """Extracts the video ID from a YouTube URL."""
        match = re.search(r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})", url)
        return match.group(1) if match else None

    @staticmethod
    def get_video_metadata(url: str) -> Dict[str, str]:
        """Fetches video metadata using yt-dlp."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info.get('title', 'Unknown Title'),
                    'channel': info.get('uploader', 'Unknown Channel'),
                    'duration': str(info.get('duration', 0)),
                    'thumbnail': info.get('thumbnail', '')
                }
        except Exception as e:
            print(f"Error fetching metadata: {e}")
            return {
                'title': 'Unknown Video',
                'channel': 'Unknown Channel',
                'duration': '0',
                'thumbnail': ''
            }

    @staticmethod
    def get_transcript(video_id: str) -> str:
        """
        Tries to fetch transcript via captions first.
        Falls back to downloading audio and using Whisper via Groq if captions fail.
        """
        # Method 1: Captions
        try:
            # Use static method directly
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            
            # Iterate over the result (FetchedTranscript should be iterable yielding objects)
            full_text = " ".join([item['text'] for item in transcript_list])
            
            # Decode HTML entities
            import html
            return html.unescape(full_text)
        except (TranscriptsDisabled, NoTranscriptFound) as e:
            print(f"Captions not found ({e}). Falling back to Whisper...")
            return VideoUtils.transcribe_with_whisper(video_id)
        except Exception as e:
            print(f"Error fetching captions: {e}")
            return VideoUtils.transcribe_with_whisper(video_id)

    @staticmethod
    def transcribe_with_whisper(video_id: str) -> str:
        """Downloads audio and uses Groq Whisper for transcription."""
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not found in environment variables.")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        # Download Audio
        filename = f"{video_id}.mp3"
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '64',
            }],
            'outtmpl': video_id, # yt-dlp appends ext automatically
            'quiet': True,
            'extractor_args': {'youtube': {'player_client': ['android']}},
            'retries': 10,
            'fragment_retries': 10,
            'socket_timeout': 30,
            # 'force_ipv4': True, # Uncomment if IPv6 issues persist
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
            
            # Note: yt-dlp might append .mp3 to the filename depending on config, check it
            if not os.path.exists(filename):
                # Try finding any file starting with video_id
                for file in os.listdir('.'):
                    if file.startswith(video_id) and file.endswith('.mp3'):
                        filename = file
                        break
            
            if not os.path.exists(filename):
                 raise FileNotFoundError("Audio file download failed.")

            # Check file size (limit is 25MB, set safe limit 24MB)
            file_size_mb = os.path.getsize(filename) / (1024 * 1024)
            
            if file_size_mb > 24:
                print(f"File size {file_size_mb:.2f}MB > 24MB. Chunking...")
                # Split using ffmpeg segment
                import subprocess
                chunk_pattern = f"{video_id}_chunk_%03d.mp3"
                subprocess.run([
                    'ffmpeg', '-i', filename, 
                    '-f', 'segment', '-segment_time', '900', # 15 mins
                    '-c', 'copy', chunk_pattern
                ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Find all chunks
                chunks = sorted([f for f in os.listdir('.') if f.startswith(f"{video_id}_chunk_") and f.endswith('.mp3')])
                full_transcription = ""
                
                for chunk in chunks:
                    try:
                        with open(chunk, "rb") as file:
                            resp = client.audio.transcriptions.create(
                                file=(chunk, file.read()),
                                model="whisper-large-v3",
                                response_format="json"
                            )
                            full_transcription += resp.text + " "
                    except Exception as e:
                        print(f"Error transcribing chunk {chunk}: {e}")
                    finally:
                        try: os.remove(chunk)
                        except: pass
                
                # Cleanup main file
                try: os.remove(filename)
                except: pass
                
                return full_transcription.strip()
            
            else:
                # Transcribe single file
                with open(filename, "rb") as file:
                    transcription = client.audio.transcriptions.create(
                        file=(filename, file.read()),
                        model="whisper-large-v3",
                        response_format="json"
                    )
                
                # Cleanup
                try: os.remove(filename)
                except: pass
                    
                return transcription.text

        except Exception as e:
            # Cleanup on error
            if os.path.exists(filename):
                try: os.remove(filename)
                except: pass
            # Cleanup chunks on error
            for f in os.listdir('.'):
                 if f.startswith(f"{video_id}_chunk_") and f.endswith('.mp3'):
                     try: os.remove(f)
                     except: pass
            raise Exception(f"Transcription failed: {str(e)}")

class AIEngine:
    def __init__(self):
        if not GROQ_API_KEY:
             raise ValueError("GROQ_API_KEY not found. Please set it in .env file.")
        self.client = Groq(api_key=GROQ_API_KEY)

    def summarize(self, text: str) -> str:
        prompt = f"""
        Please provide a comprehensive summary of the following transcript.
        Use Markdown formatting.
        Structure:
        
        ## Executive Summary
        (A brief overview)
        
        ## Key Points
        - (Bullet points)
        
        ## Detailed Breakdown
        (Sections with headers if appropriate)
        
        Transcript:
        {text[:22000]} 
        """ 
        # Truncate to stay under strict 6000 TPM limits
        
        completion = self.client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant that summarizes video transcripts."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant", 
        )
        return completion.choices[0].message.content

    def chat(self, text: str, history: List[Dict[str, str]], question: str) -> str:
        messages = [{"role": "system", "content": "You are a helpful assistant answering questions about a video transcript."}]
        
        # Add context (transcript) - usually best to add as system context or first user message
        messages.append({"role": "system", "content": f"Context (Video Transcript): {text[:22000]}"})
        
        # Add history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        # Add current question
        messages.append({"role": "user", "content": question})
        
        completion = self.client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",
        )
        return completion.choices[0].message.content

class PDFGenerator:
    @staticmethod
    def generate(transcript: str, summary: str, metadata: Dict[str, str]) -> bytes:
        pdf = FPDF()
        pdf.add_page()
        
        # Helper to add text with wrapping
        def add_text(text, style='', size=12):
            pdf.set_font("Arial", style, size)
            # Force ASCII compatible
            import unicodedata
            normalized = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
            pdf.multi_cell(0, 6, normalized)
            pdf.ln(2)

        # Header
        pdf.set_font("Arial", 'B', 24)
        pdf.set_text_color(59, 130, 246)
        pdf.cell(0, 10, "YouTube-to-Text Pro", 0, 1)
        pdf.ln(5)
        
        pdf.set_font("Arial", '', 10)
        pdf.set_text_color(128, 128, 128)
        pdf.cell(0, 10, f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}", 0, 1)
        
        # Sanitize title
        import unicodedata
        safe_title = unicodedata.normalize('NFKD', metadata.get('title', 'Unknown')).encode('ascii', 'ignore').decode('ascii')
        pdf.cell(0, 10, f"Video: {safe_title}", 0, 1)
        pdf.ln(10)

        # Summary
        if summary:
            pdf.set_font("Arial", 'B', 18)
            pdf.set_text_color(139, 92, 246)
            pdf.cell(0, 10, "AI Summary & Insights", 0, 1)
            pdf.ln(5)
            
            # Simple markdown cleaning for PDF
            clean_summary = summary.replace('##', '').replace('**', '')
            pdf.set_text_color(0, 0, 0)
            add_text(clean_summary, size=11)
            pdf.ln(10)
            
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(10)

        # Transcript
        pdf.set_font("Arial", 'B', 18)
        pdf.set_text_color(59, 130, 246)
        pdf.cell(0, 10, "Full Transcript", 0, 1)
        pdf.ln(5)
        
        pdf.set_text_color(0, 0, 0)
        add_text(transcript, size=10)
        
        return pdf.output(dest='S').encode('latin-1')
