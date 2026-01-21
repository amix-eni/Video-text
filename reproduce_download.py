
import yt_dlp
import traceback

def test_download():
    # Searching for a typically long ICT Mentorship video that might trigger this
    # "ICT Mentorship 2022 - Episode 1"
    video_url = "https://www.youtube.com/watch?v=PbA4W1n6rYs" 
    
    print(f"Testing download for: {video_url}")
    
    # Current options from utils.py
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': False, # Verbose for debug
        'extractor_args': {'youtube': {'player_client': ['android']}},
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(video_url, download=True)
        print("Download successful!")
    except Exception:
        print("Download failed!")
        traceback.print_exc()

if __name__ == "__main__":
    test_download()
