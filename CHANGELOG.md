# Changelog

## 0.1.0

- First release.
- Conversation view **音频提取 / Audio extraction**, registered next to the 3D workbench.
- `/audio-extract` session command: stream-copy the video audio track into `.m4a` (no re-encode).
- Trims the beginning and the end of the audio.
- Writes `title`, `artist`, `album` and `lyrics` metadata.
- Embeds a cover image as `attached_pic`.
- `GET /audio-extract/list` and `POST /audio-extract/upload` local routes for folder listing and cover upload.
- Theme-token based UI that follows the light/dark theme.
