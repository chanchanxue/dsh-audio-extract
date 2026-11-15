# dsh-audio-extract

从视频里无损提取音频的 DeepSeek Harness 插件。

它在视图切换条里新增一个 **音频提取** 页：选择文件夹、勾选视频、可选裁剪开头与结尾，填歌名/歌手、选封面图与歌词文件 —— 插件用 `-c:a copy` 把音轨从视频里流复制成 `.m4a`（不重新编码），再写入元数据。

## 功能

- **天然无损** —— 音频走 `-c:a copy` 重新封装，ffmpeg 不解码，AAC 帧与源文件逐字节一致。
- **双端裁剪** —— `开头剪掉` / `结尾剪掉`（秒），切点落在 AAC 帧边界上。
- **元数据** —— `title`、`artist`、可选 `album` 与 `lyrics`（`©lyr`），写进 MP4 容器。
- **封面** —— 选中的图片以内嵌图片流（`attached_pic` / `covr`）写入，播放器与 iPhone「音乐」都能显示。
- **文件夹选择 + 封面/歌词直接选取** —— 文件夹走系统原生目录对话框；封面经本地路由上传后自动回填路径，歌词直接从 `.lrc`/`.txt` 读取。

## 依赖

- DeepSeek Harness 的 Web 界面（插件注册一个对话视图和一条会话命令）。
- **ffmpeg**：在 `PATH` 上、或位于 `C:\ffmpeg\bin\ffmpeg.exe`、或由环境变量 `DSH_AUDIO_EXTRACT_FFMPEG` 指定。
- 源视频音轨为 AAC（mp4/mov/m4v/mkv 等）；AC-3、DTS 等会被明确拒绝，不会偷偷重编码。

## 安装

在 设置 → 插件 中安装，或：

```sh
dsh plugin --profile <profile> add github:chanchanxue/dsh-audio-extract
```

## 使用

1. 打开一个会话，在视图切换条点 **音频提取**。
2. 选择视频文件夹，视频会自动列出。
3. 需要时设置开头/结尾裁剪秒数，填歌名、歌手，可选封面与歌词文件。
4. 点 **开始提取**。结果会列出每个输出文件的大小、时长，以及写入了哪些元数据。

## 实现

| 部分 | 说明 |
| --- | --- |
| 视图 | `conversation.view`，id `audio-extract`，order `31` |
| 命令 | `/audio-extract <base64 JSON>`，页面通过会话命令 API 调用 |
| 路由 `GET /audio-extract/list?path=…` | 列出文件夹里的视频（组合出来的目录选择器是 `native` 模式，不能浏览） |
| 路由 `POST /audio-extract/upload?name=…` | 把上传的封面存进系统临时目录并返回绝对路径 |

全程本地运行：不联网、不外传、不采集遥测。

## 限制

- 输出容器固定 `.m4a`，仅适用于 AAC 音轨；其它编码会失败并给出原因。
- 裁剪精确到 AAC 帧（约 23 毫秒），不是采样级精确 —— 这是不重新编码的代价。
- 封面/歌词用浏览器文件选择框；封面会被复制到系统临时目录。

## 许可

MIT
