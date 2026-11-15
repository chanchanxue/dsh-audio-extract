# 发布清单 / Publishing checklist

两件事：先把仓库放到 GitHub，再往插件市场（dsh-market）的目录仓库提一个 PR。

## 1. 建 GitHub 仓库并推送

仓库名建议就叫 `dsh-audio-extract`（市场条目里的 `url` 必须与之完全一致）。

```sh
cd audio-extract-release
git init
git add .
git commit -m "feat: audio extraction plugin for DeepSeek Harness 0.1.0"
git branch -M main
git remote add origin https://github.com/chanchanxue/dsh-audio-extract.git
git push -u origin main
```

没有本地 git 时，也可以在 GitHub 网页点 **New repository → upload files**，把本目录里的文件全部拖进去（`node_modules` 不用传，本目录本来就没有）。

建好仓库后：

- 给仓库加 topic：`dsh-plugin`（市场收录的硬性要求之一）
- 仓库需要**创建满 24 小时**后才能通过收录 CI（提前提 PR 会被自动挡住，等够时间重提即可）

## 2. 提市场 PR

市场里的插件列表来自 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（dsh-market 会自动同步它）。

1. Fork 上面这个仓库
2. 新建一个文件：`data/plugins/chanchanxue__dsh-audio-extract.yml`
3. 内容用本目录的 `market-entry.yml`
4. 只新增这一个文件，不要改 README（两个 README 由脚本从 `data/plugins/*.yml` 生成）
5. 提 PR

CI 会依次检查：PR 条目数 ≤ 3、目标仓库 `package.json` 里有 `dsh.bundle`（本仓库已有）、仓库年龄 ≥ 1 天、以及格式与站点构建。通过后再由维护者人工读代码核对描述是否属实。

## 3. 可选：更容易安装

- 把包发到 npm（名字 `dsh-audio-extract`），并把 `package.json` 里的 `repository` 指回这个仓库 —— 市场会自动关联下载量，安装时也不需要构建授权。
- 或者把预构建的 `.tgz` 传到 GitHub Release，然后在条目里加 `tarball:` 字段。
- 想给市场卡片换图标：条目里的 `icon:` 只接受 **GitHub 托管的位图**（png/jpg/webp），本仓库的 `icon.svg` 不适用；不写就回退到作者头像。
- 想控制市场详情页的截图顺序：在仓库根加 `screenshots.json`，列出 1–8 张图片的相对路径。

## 4. 发之前建议做的事

- 在本地把界面流程走一遍（选文件夹 → 清单出现 → 勾选 → 开始提取），确认没有上一版「清单空白」的问题。
- 确认目标机器上有 ffmpeg（`PATH` 上、`C:\ffmpeg\bin\ffmpeg.exe`、或设置了 `DSH_AUDIO_EXTRACT_FFMPEG`）。
- 描述要与代码一致：本条目只声明了「流复制、双端裁剪、写歌名/歌手/封面/歌词」，没有夸大工具数量或额外能力。
