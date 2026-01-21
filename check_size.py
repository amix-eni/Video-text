
import os
import yt_dlp

def check_size():
    video_url = "https://www.youtube.com/watch?v=PbA4W1n6rYs"
    video_id = "PbA4W1n6rYs"
    
    print(f"Checking size for: {video_url}")
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '64',
        }],
        'outtmpl': video_id,
        'quiet': False,
        'retries': 10,
        'fragment_retries': 10,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
            
        filename = f"{video_id}.mp3"
        if os.path.exists(filename):
            size_mb = os.path.getsize(filename) / (1024 * 1024)
            print(f"File Size: {size_mb:.2f} MB")
            if size_mb > 25:
                print("FAILURE: File exceeds 25MB limit!")
            else:
                print("SUCCESS: File is under 25MB.")
        else:
            print("File not found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_size()
