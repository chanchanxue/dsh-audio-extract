# dsh-audio-extract

Lossless audio extraction from video, as a DeepSeek Harness plugin.

It adds an **音频提取 / Audio extraction** view next to the 3D workbench. Pick a folder, choose the videos, optionally trim the beginning and the end, fill in title/artist, pick a cover image and a lyrics file — the plugin stream-copies the audio track out of each video into an `.m4a` without re-encoding, then writes the metadata.

## What it does

- **Lossless by construction** — the audio is remuxed with `-c:a copy`; ffmpeg never decodes it, so the AAC frames stay byte-identical to the source.
- **Trims both ends** — `trimStart` / `trimEnd` in seconds; the cut lands on AAC frame boundaries.
- **Metadata** — `title`, `artist`, optional `album` and `lyrics` (`©lyr`), written into the MP4 container.
- **Cover art** — a chosen image is embedded as an `attached_pic` stream (`covr`), so players and the iPhone Music app show it.
- **Folder picker + direct cover/lyrics selection** — the folder comes from the native directory dialog; covers are uploaded through a local route and lyrics are read from a `.lrc`/`.txt` file.

## Requirements

- DeepSeek Harness with the Web UI (the plugin registers a conversation view and one session command).
- **ffmpeg** available either on `PATH`, at `C:\ffmpeg\bin\ffmpeg.exe`, or pointed to by the `DSH_AUDIO_EXTRACT_FFMPEG` environment variable.
- Source videos with AAC audio (`mp4`/`mov`/`m4v`/`mkv`/…); other codecs (AC-3, DTS) are rejected with a reason rather than silently re-encoded.

## Install

From the plugin manager (Settings → Plugins), or:

```sh
dsh plugin --profile <profile> add github:chanchanxue/dsh-audio-extract
```

## Use

1. Open a session, click **音频提取** in the view switcher (right of 3D workbench).
2. Choose the video folder — the videos are listed automatically.
3. Set the start/end trim if needed, fill title/artist, optionally pick a cover and a lyrics file.
4. Click **开始提取**. The command result lists every produced file with size, duration and which metadata was written.

## How it works

| Piece | Detail |
| --- | --- |
| View | `conversation.view`, id `audio-extract`, order `31` |
| Command | `/audio-extract <base64 JSON>` — the page builds the payload and calls it through the session command API |
| Route `GET /audio-extract/list?path=…` | Lists video files in a folder (the composed directory picker serves `native` and cannot browse) |
| Route `POST /audio-extract/upload?name=…` | Stores an uploaded cover in the OS temp dir and returns its absolute path |

Everything runs locally: no network calls, no uploads outside your machine, no telemetry.

## Limitations

- Output container is `.m4a`; it is only chosen for AAC sources. Non-AAC tracks need a different container and currently fail with a message.
- Trimming is frame-accurate to the AAC frame (~23 ms), not sample-accurate — that is the trade-off for not re-encoding.
- The cover/lyrics pickers use the browser's file input; the cover is copied into the OS temp folder.

## License

MIT
